# FASSTO Herald — AWS 배포 요청서

> fms-release-note (FASSTO Herald) 서비스를 AWS 인프라에 배포하기 위한 가이드
>
> **최종 업데이트**: 2026-04-06

## 1. 아키텍처 개요

```
                     ┌─────────────────────────────────┐
                     │   Route 53 (herald.fassto.ai)    │
                     └───────────────┬─────────────────┘
                                     │
                     ┌───────────────▼─────────────────┐
                     │   ALB (AWS Load Balancer)        │
                     │   ACM SSL 종료 (HTTPS→HTTP)      │
                     └───────────────┬─────────────────┘
                                     │ HTTP:80
                     ┌───────────────▼─────────────────┐
                     │   Istio IngressGateway           │
                     │   (Gateway CRD)                  │
                     └───────────────┬─────────────────┘
                                     │
                     ┌───────────────▼─────────────────┐
                     │   VirtualService (herald-vs)     │
                     │   /* → app (Next.js)             │
                     └───────────────┬─────────────────┘
                                     │
                     ┌───────────────▼─────────────────┐
                     │   Argo Rollout (Canary)          │
                     │   app — Port 3100                │
                     └──────┬─────────────────┬────────┘
                            │                 │
            ┌───────────────▼──────┐  ┌───────▼───────────────────┐
            │   RDS MySQL          │  │   S3 Bucket               │
            │   (herald DB)        │  │   (스크린샷 업로드)        │
            └──────────────────────┘  └───────────────────────────┘
```

### 핵심 설계 결정

| 항목 | 선택 | 근거 |
|------|------|------|
| 컴퓨팅 | **EKS** (기존 Fassto 클러스터) | 사내 표준 인프라 활용 |
| 서비스 메시 | **Istio** | Fassto 표준 — VirtualService 라우팅, mTLS |
| 배포 전략 | **Argo Rollouts** (Canary) | Istio weight 기반 점진적 배포 |
| SSL 종료 | **ALB** (ACM) | Istio IngressGateway는 HTTP만 수신 |
| DBMS | **RDS MySQL** | 운영 환경 표준 — 자동 백업, 다중 AZ, Pod 스케일링 자유 |
| 파일 스토리지 | **S3** | 스크린샷 업로드 — Pod 무상태, 다중 Pod 호환 |
| 애플리케이션 | **Next.js 풀스택** | 프론트엔드 + API가 단일 컨테이너 |
| 스케일링 | **KEDA** (Scale-to-Zero) | 주 1회 사용 — 유휴 시 Pod 0개로 리소스 절약 |

---

## 2. AWS 관리자 요청 사항

아래 내용을 AWS 관리자에게 전달하여 인프라 준비를 요청합니다.

### 2-1. ECR (Container Registry)

```
리포지토리 1개 생성:
  - fassto-herald
리전: ap-northeast-2 (서울)
```

### 2-2. S3 Bucket (스크린샷 업로드)

```
버킷명: fassto-herald-uploads
리전: ap-northeast-2 (서울)
퍼블릭 액세스: 활성화 (이메일 내 이미지 직접 참조용)
버킷 정책: GetObject 퍼블릭 허용 (uploads/ 프리픽스)
암호화: SSE-S3 (기본)
버전 관리: 비활성화
수명 주기: 180일 후 자동 삭제 (선택)
```

> **S3 용도**: 스크린샷 업로드 파일을 저장합니다.
> Pod 무상태로 동작하여 스케일링에 제약이 없습니다.

### 2-3. RDS MySQL

```
엔진: MySQL 8.0
인스턴스: db.t4g.micro (최소 사양 — 최대 5명 사용)
리전: ap-northeast-2 (서울)
스토리지: gp3, 20GB
DB 이름: herald
마스터 사용자: herald_admin

네트워크:
  - VPC: EKS 클러스터와 동일 VPC
  - 서브넷 그룹: 프라이빗 서브넷 (EKS 워커 노드와 동일 AZ)
  - 퍼블릭 액세스: 비활성화

백업:
  - 자동 백업: 활성화 (보존 기간 7일)
  - 백업 윈도우: 18:00-19:00 UTC (KST 03:00-04:00)

보안그룹 (rds-herald-sg):
  - Inbound: eks-node-sg에서 3306 (MySQL) 허용
```

### 2-4. EKS 네임스페이스 + Istio

```
기존 Fassto EKS 클러스터에 네임스페이스 생성:
  - fassto-herald
  - Istio sidecar injection 활성화: kubectl label ns fassto-herald istio-injection=enabled

필수 구성 요소 (기존 클러스터에 설치 확인):
  - Istio (IngressGateway, VirtualService)
  - Argo Rollouts Controller
  - KEDA (Kubernetes Event-Driven Autoscaling) — Scale-to-Zero용
  - KEDA HTTP Add-on — HTTP 요청 기반 자동 기동용
```

### 2-5. ALB + Istio IngressGateway

```
ALB:
  - 리스너: HTTPS 443 (ACM 인증서 연결)
  - HTTP 80 → HTTPS 301 리다이렉트
  - 타겟: Istio IngressGateway Service (HTTP:80)
  - SSL 종료: ALB에서 수행, IngressGateway는 HTTP만 수신

라우팅:
  - ALB → Istio IngressGateway → VirtualService → app
```

### 2-6. Route 53

```
A 레코드 (Alias): herald.fassto.ai → ALB DNS
```

### 2-7. K8s Secrets

```
kubectl -n fassto-herald create secret generic herald-secrets \
  --from-literal=DATABASE_URL='mysql://herald_admin:<비밀번호>@<RDS엔드포인트>:3306/herald' \
  --from-literal=NEXTAUTH_SECRET='<랜덤 64자 문자열>' \
  --from-literal=JIRA_API_TOKEN='<JIRA API 토큰>' \
  --from-literal=ANTHROPIC_API_KEY='<Anthropic API 키>' \
  --from-literal=SLACK_BOT_TOKEN='<Slack Bot 토큰>' \
  --from-literal=SMTP_PASS='<Gmail 앱 비밀번호>'
```

> **S3 접근**: Pod의 IAM Role(IRSA)로 인증하므로 Secret에 AWS 키 불필요.

### 2-8. IAM Role for Service Account (IRSA)

```
EKS Pod에서 S3에 접근하기 위한 IAM 설정:

1. IAM 정책 생성 (fassto-herald-s3-policy):
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:DeleteObject"],
         "Resource": "arn:aws:s3:::fassto-herald-uploads/uploads/*"
       }
     ]
   }

2. IAM Role 생성 (fassto-herald-s3-role):
   - 신뢰 정책: EKS OIDC Provider 연결
   - 위 정책 연결

3. K8s ServiceAccount 어노테이션:
   kubectl -n fassto-herald annotate serviceaccount default \
     eks.amazonaws.com/role-arn=arn:aws:iam::<ACCOUNT_ID>:role/fassto-herald-s3-role
```

### 2-9. 보안그룹

```
eks-node-sg (기존):
  - Outbound: RDS 보안그룹 3306 (MySQL) 허용 추가
  - Outbound: HTTPS 443 (외부 API — JIRA, Anthropic, Slack, Gmail SMTP, S3)

rds-herald-sg:
  - Inbound: eks-node-sg에서 3306 허용
```

---

## 3. Dockerfile

### 3-1. 애플리케이션 (`Dockerfile`)

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .

# Prisma 클라이언트 생성
RUN npx prisma generate

# Next.js 빌드
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# 비 root 사용자 (보안)
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# standalone 빌드 결과 복사
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs

EXPOSE 3100
ENV PORT=3100
CMD ["node", "server.js"]
```

> **`next.config.ts`에 `output: "standalone"` 추가 필요** (배포 전 설정)

### 3-2. `.dockerignore`

```
node_modules/
.next/
out/
.env
.env.*
.git/
specs/
tests/
test-results/
.specify/
*.md
figma-prompt.md
```

### 3-3. 헬스체크 엔드포인트

`src/app/api/health/route.ts`:
```typescript
export function GET() {
  return Response.json({ status: "ok" });
}
```

---

## 4. Kubernetes 매니페스트 (Istio + Argo Rollouts)

### 4-1. App Argo Rollout + Service

```yaml
# k8s/app.yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: app
  namespace: fassto-herald
spec:
  replicas: 1
  strategy:
    canary:
      canaryService: app-canary
      stableService: app
      trafficRouting:
        istio:
          virtualServices:
            - name: herald-vs
              routes:
                - app-route
      steps:
        - setWeight: 20
        - pause: { duration: 60s }
        - setWeight: 50
        - pause: { duration: 60s }
        - setWeight: 100
        - pause: {}
  selector:
    matchLabels:
      app: herald
  template:
    metadata:
      labels:
        app: herald
    spec:
      containers:
        - name: app
          image: {ECR}/fassto-herald:latest
          ports:
            - containerPort: 3100
          env:
            - name: NEXTAUTH_URL
              value: "https://herald.fassto.ai"
            - name: JIRA_BASE_URL
              value: "https://fssuniverse.atlassian.net"
            - name: JIRA_USER_EMAIL
              value: "albert.rim@fassto.com"
            - name: SMTP_USER
              value: "albert.rim@fassto.com"
            - name: ANTHROPIC_BASE_URL
              value: "https://litellm.fassto.ai"
            - name: ANTHROPIC_MODEL
              value: "claude-opus-4-6"
            - name: AWS_REGION
              value: "ap-northeast-2"
            - name: S3_BUCKET
              value: "fassto-herald-uploads"
            - name: S3_PREFIX
              value: "uploads"
          envFrom:
            - secretRef:
                name: herald-secrets
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3100
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3100
            initialDelaySeconds: 5
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: app
  namespace: fassto-herald
spec:
  selector:
    app: herald
  ports:
    - port: 3100
      targetPort: 3100
---
apiVersion: v1
kind: Service
metadata:
  name: app-canary
  namespace: fassto-herald
spec:
  selector:
    app: herald
  ports:
    - port: 3100
      targetPort: 3100
```

### 4-2. Istio Gateway + VirtualService

```yaml
# k8s/istio.yaml
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: herald-gw
  namespace: fassto-herald
spec:
  selector:
    istio: ingressgateway
  servers:
    - port:
        number: 80
        name: http
        protocol: HTTP
      hosts:
        - herald.fassto.ai
---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: herald-vs
  namespace: fassto-herald
spec:
  hosts:
    - herald.fassto.ai
  gateways:
    - herald-gw
  http:
    - name: app-route
      route:
        - destination:
            host: app
            port:
              number: 3100
          weight: 100
        - destination:
            host: app-canary
            port:
              number: 3100
          weight: 0
```

---

## 5. 배포 절차

### 5-1. 배포 전 코드 변경

```typescript
// next.config.ts — standalone 출력 추가
const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
};
```

```typescript
// src/app/api/health/route.ts — 헬스체크 엔드포인트
export function GET() {
  return Response.json({ status: "ok" });
}
```

```typescript
// src/lib/prisma.ts — DATABASE_URL 환경변수로 RDS MySQL 연결
// K8s Secret에서 DATABASE_URL 주입
```

### 5-2. 최초 배포

```bash
# 0. ECR 로그인
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin {ACCOUNT_ID}.dkr.ecr.ap-northeast-2.amazonaws.com

# 1. 이미지 빌드 & 푸시
docker build -t fassto-herald .
docker tag fassto-herald:latest {ECR_URI}/fassto-herald:latest
docker push {ECR_URI}/fassto-herald:latest

# 2. K8s 리소스 생성
kubectl create namespace fassto-herald
kubectl label ns fassto-herald istio-injection=enabled

kubectl -n fassto-herald create secret generic herald-secrets \
  --from-literal=DATABASE_URL='mysql://herald_admin:<비밀번호>@<RDS엔드포인트>:3306/herald' \
  --from-literal=NEXTAUTH_SECRET='<랜덤 64자>' \
  --from-literal=JIRA_API_TOKEN='<토큰>' \
  --from-literal=ANTHROPIC_API_KEY='<키>' \
  --from-literal=SLACK_BOT_TOKEN='<토큰>' \
  --from-literal=SMTP_PASS='<앱비밀번호>'

# IRSA 설정 (S3 접근용)
kubectl -n fassto-herald annotate serviceaccount default \
  eks.amazonaws.com/role-arn=arn:aws:iam::<ACCOUNT_ID>:role/fassto-herald-s3-role

kubectl apply -f k8s/istio.yaml
kubectl apply -f k8s/app.yaml

# 3. DB 마이그레이션 (Pod 내에서 실행)
kubectl -n fassto-herald exec deploy/app -- npx prisma migrate deploy
kubectl -n fassto-herald exec deploy/app -- npx tsx prisma/seed.ts
```

### 5-3. 이후 업데이트 배포

```bash
# 이미지 빌드 & 푸시 후
kubectl -n fassto-herald argo rollouts set image app \
  app={ECR_URI}/fassto-herald:{TAG}

# 배포 상태 확인
kubectl -n fassto-herald argo rollouts status app

# 수동 promote (pause 단계에서)
kubectl -n fassto-herald argo rollouts promote app

# 롤백 (문제 발생 시)
kubectl -n fassto-herald argo rollouts undo app
```

---

## 6. 환경변수 목록

### K8s Deployment env + Secret

| 변수 | 설명 | 소스 | 필수 |
|------|------|------|------|
| `DATABASE_URL` | RDS MySQL 연결 문자열 | K8s Secret | O |
| `NEXTAUTH_SECRET` | Auth.js 시크릿 키 (64자+) | K8s Secret | O |
| `NEXTAUTH_URL` | 서비스 URL | env | O |
| `JIRA_BASE_URL` | Atlassian Cloud URL | env | O |
| `JIRA_API_TOKEN` | JIRA API 토큰 | K8s Secret | O |
| `JIRA_USER_EMAIL` | JIRA 서비스 계정 이메일 | env | O |
| `ANTHROPIC_API_KEY` | Anthropic API 키 | K8s Secret | O |
| `ANTHROPIC_BASE_URL` | Anthropic/LiteLLM 프록시 URL | env | O |
| `ANTHROPIC_MODEL` | AI 모델명 | env | O |
| `AWS_REGION` | AWS 리전 | env | O |
| `S3_BUCKET` | S3 버킷명 | env | O |
| `S3_PREFIX` | S3 키 프리픽스 | env | O |
| `SLACK_BOT_TOKEN` | Slack Bot 토큰 | K8s Secret | O |
| `SMTP_USER` | Gmail 계정 | env | O |
| `SMTP_PASS` | Gmail 앱 비밀번호 | K8s Secret | O |

### 외부 API 접근 (Outbound HTTPS 443 필요)

| 서비스 | 도메인 | 용도 |
|--------|--------|------|
| RDS MySQL | `<RDS엔드포인트>:3306` | 데이터베이스 (VPC 내부) |
| S3 | `s3.ap-northeast-2.amazonaws.com` | 스크린샷 업로드 (HTTPS) |
| JIRA | `fssuniverse.atlassian.net` | Release Note 티켓 조회 |
| LiteLLM (Anthropic) | `litellm.fassto.ai` | AI 텍스트 변환 |
| Slack | `slack.com` | 메시지 조회, 요청자 추출 |
| Gmail SMTP | `smtp.gmail.com:587` | 이메일 발송 |

---

## 7. 백업 전략

### RDS 자동 백업 (기본 활성화)

```
RDS 자동 백업:
  - 보존 기간: 7일
  - 백업 윈도우: 18:00-19:00 UTC (KST 03:00-04:00)
  - 스냅샷 수동 생성: 주요 배포 전 권장
```

### S3 수명 주기 (선택)

```
S3 Lifecycle Rule:
  - 대상: uploads/ 프리픽스
  - 180일 후 자동 삭제 (오래된 스크린샷 정리)
```

---

## 8. 운영

### 8-1. 헬스체크

```bash
curl https://herald.fassto.ai/api/health
# → {"status":"ok"}
```

### 8-2. 로그 확인

```bash
kubectl -n fassto-herald logs deploy/app --tail=100 -f
```

### 8-3. Pod 상태 확인

```bash
kubectl -n fassto-herald get pods
kubectl -n fassto-herald describe pod <pod-name>
```

---

## 9. Scale-to-Zero (리소스 최적화)

이 서비스는 주 1회 정도 사용되므로, 유휴 시 Pod를 0개로 축소하여 리소스를 절약합니다.

### 9-1. 방안 비교

| 방안 | 장점 | 단점 | 권장 |
|------|------|------|------|
| **KEDA HTTP Add-on** | 자동 기동/축소, 요청 유실 없음 | KEDA + Add-on 설치 필요 | **권장** |
| **수동 스케일링** | 추가 설치 없음, 단순 | 사용 전 수동 기동 필요 | 대안 |
| **CronJob 스케줄** | 반자동 | 불규칙 사용 패턴에 부적합 | 비권장 |

### 9-2. 권장: KEDA HTTP Add-on (자동 Scale-to-Zero)

KEDA HTTP Add-on은 HTTP 요청을 프록시하며, Pod가 0개일 때 요청이 들어오면 자동으로 Pod를 기동하고 요청을 대기시킵니다.

#### 사전 설치

```bash
# KEDA 설치
helm repo add kedacore https://kedacore.github.io/charts
helm install keda kedacore/keda -n keda-system --create-namespace

# KEDA HTTP Add-on 설치
helm install http-add-on kedacore/keda-add-ons-http -n keda-system
```

#### HTTPScaledObject 매니페스트

```yaml
# k8s/keda-http.yaml
apiVersion: http.keda.sh/v1alpha1
kind: HTTPScaledObject
metadata:
  name: herald-scaledobject
  namespace: fassto-herald
spec:
  hosts:
    - herald.fassto.ai
  pathPrefixes:
    - /
  scaleTargetRef:
    name: app                    # Argo Rollout 이름
    kind: Rollout
    apiVersion: argoproj.io/v1alpha1
    service: app                 # 트래픽을 받는 Service 이름
    port: 3100
  replicas:
    min: 0                       # 유휴 시 0개
    max: 2                       # 최대 2개 (RDS이므로 스케일링 자유)
  scalingMetric:
    requestRate:
      targetValue: 1             # 요청 1개 이상이면 스케일 업
      granularity: 1s
      window: 1m
  scaledownPeriod: 300           # 5분간 요청 없으면 스케일 다운
```

> **동작 흐름**:
> 1. 유휴 상태: Pod 0개 (CPU/메모리 소비 없음)
> 2. 사용자가 `herald.fassto.ai` 접속
> 3. KEDA HTTP Add-on 인터셉터가 요청을 대기열에 보관
> 4. Pod 1개 자동 기동 (~15-30초)
> 5. Pod Ready 후 요청 전달
> 6. 5분간 추가 요청 없으면 다시 Pod 0개로 축소

> **Cold Start 참고**: 최초 접속 시 Pod 기동까지 15-30초 소요됩니다.
> 주 1회 사용 패턴에서는 허용 가능한 수준입니다.

#### Istio 연동 시 주의

KEDA HTTP Add-on은 자체 프록시를 통해 트래픽을 라우팅합니다.
Istio VirtualService의 destination을 KEDA 인터셉터 프록시 Service로 변경해야 합니다.

```yaml
# k8s/istio.yaml — VirtualService 수정 (KEDA 연동)
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: herald-vs
  namespace: fassto-herald
spec:
  hosts:
    - herald.fassto.ai
  gateways:
    - herald-gw
  http:
    - name: app-route
      route:
        - destination:
            host: keda-add-ons-http-interceptor-proxy.keda-system.svc.cluster.local
            port:
              number: 8080
          weight: 100
```

#### Argo Rollout 수정

KEDA가 replicas를 관리하므로, Rollout에서 `replicas` 필드를 제거합니다.

```yaml
# k8s/app.yaml 에서 변경
spec:
  # replicas: 1  ← 제거 (KEDA가 관리)
  strategy:
    canary:
      ...
```

### 9-3. 대안: 수동 스케일링

KEDA 설치가 어려운 경우, 수동으로 Pod를 기동/중지할 수 있습니다.

```bash
# 서비스 기동 (사용 전)
kubectl -n fassto-herald argo rollouts set replicas app 1
kubectl -n fassto-herald argo rollouts status app  # Ready 확인

# 서비스 중지 (사용 후)
kubectl -n fassto-herald argo rollouts set replicas app 0
```

> **Tip**: Slack Workflow나 간단한 스크립트로 `/herald-start`, `/herald-stop` 명령을 만들면
> 비개발자도 직접 서비스를 기동/중지할 수 있습니다.

### 9-4. 예상 리소스 절감

| 항목 | 상시 가동 (기존) | Scale-to-Zero |
|------|-----------------|---------------|
| Pod 가동 시간 | 24h × 7일 = **168h/주** | ~2-3h/주 (사용 시만) |
| CPU (requests) | 100m × 168h | 100m × ~3h |
| 메모리 (requests) | 256Mi × 168h | 256Mi × ~3h |
| **절감률** | — | **~98%** |

> **참고**: RDS 비용은 인스턴스 가동 시간 기준이므로 Scale-to-Zero와 무관하게 동일합니다.
> S3는 스크린샷 저장 용도로 비용이 미미합니다 (GB당 $0.023/월).

---

## 10. 체크리스트

### 배포 전 — AWS 관리자

- [ ] ECR: 리포지토리 `fassto-herald` 생성
- [ ] RDS: MySQL 8.0 인스턴스 생성 (`herald` DB, `herald_admin` 사용자)
- [ ] RDS: 보안그룹 `rds-herald-sg` 생성 (EKS 노드 → 3306 허용)
- [ ] S3: 버킷 `fassto-herald-uploads` 생성 (퍼블릭 GetObject 허용)
- [ ] IAM: IRSA 역할 `fassto-herald-s3-role` 생성 (S3 PutObject/DeleteObject)
- [ ] EKS: 네임스페이스 `fassto-herald` 생성 + Istio sidecar injection 활성화
- [ ] EKS: Istio, Argo Rollouts Controller 설치 확인
- [ ] EKS: KEDA + KEDA HTTP Add-on 설치 (Scale-to-Zero용)
- [ ] ALB: Istio IngressGateway 연결 (HTTPS→HTTP 종료)
- [ ] Route 53: `herald.fassto.ai` A 레코드 → ALB
- [ ] 보안그룹: EKS 노드 → RDS 3306, HTTPS 443 허용
- [ ] ACM: `herald.fassto.ai` SSL 인증서

### 배포 전 — 개발자

- [ ] `next.config.ts`에 `output: "standalone"` 추가
- [ ] `Dockerfile` 생성
- [ ] `.dockerignore` 파일 생성
- [ ] `src/app/api/health/route.ts` 헬스체크 엔드포인트 추가
- [ ] `k8s/` 디렉토리에 매니페스트 파일 생성 (KEDA HTTPScaledObject 포함)
- [ ] K8s Secret 생성 (`herald-secrets`)
- [ ] 로컬 Docker 빌드 테스트

### 배포 후

- [ ] `https://herald.fassto.ai/api/health` → `{"status":"ok"}`
- [ ] 로그인 정상 동작
- [ ] JIRA 릴리즈 URL → 초안 생성 동작
- [ ] 이메일 발송 동작
- [ ] 스크린샷 업로드 → S3 저장 확인 (이메일 내 이미지 표시 확인)
- [ ] RDS 연결 및 마이그레이션 확인
- [ ] RDS 자동 백업 활성화 확인
- [ ] Scale-to-Zero 동작 확인 (5분 유휴 후 Pod 0개 → 재접속 시 자동 기동)
