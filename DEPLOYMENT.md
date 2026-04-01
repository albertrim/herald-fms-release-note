# FASSTO Herald — AWS 배포 요청서

> fms-release-note (FASSTO Herald) 서비스를 AWS 인프라에 배포하기 위한 가이드
>
> **최종 업데이트**: 2026-04-01

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
                     └───────────────┬─────────────────┘
                                     │
                     ┌───────────────▼─────────────────┐
                     │   EFS (PVC)                      │
                     │   ├─ data.db (SQLite)            │
                     │   └─ uploads/ (스크린샷)          │
                     └─────────────────────────────────┘
```

### 핵심 설계 결정

| 항목 | 선택 | 근거 |
|------|------|------|
| 컴퓨팅 | **EKS** (기존 Fassto 클러스터) | 사내 표준 인프라 활용 |
| 서비스 메시 | **Istio** | Fassto 표준 — VirtualService 라우팅, mTLS |
| 배포 전략 | **Argo Rollouts** (Canary) | Istio weight 기반 점진적 배포 |
| SSL 종료 | **ALB** (ACM) | Istio IngressGateway는 HTTP만 수신 |
| DBMS | **SQLite** (EFS 위) | 최대 5명, 월 5건 — RDS 불필요 |
| 파일 스토리지 | **EFS** (PVC 마운트) | DB 파일 + 스크린샷 업로드 영속 저장 |
| 애플리케이션 | **Next.js 풀스택** | 프론트엔드 + API가 단일 컨테이너 |

> **SQLite 주의사항**: Pod replica를 **1개**로 유지해야 합니다.
> SQLite는 동시 쓰기를 직렬화하므로, 여러 Pod에서 같은 DB 파일에 접근하면 lock 충돌이 발생합니다.
> 이 서비스의 트래픽 규모(최대 5명)에서는 단일 Pod으로 충분합니다.

---

## 2. AWS 관리자 요청 사항

아래 내용을 AWS 관리자에게 전달하여 인프라 준비를 요청합니다.

### 2-1. ECR (Container Registry)

```
리포지토리 1개 생성:
  - fassto-herald
리전: ap-northeast-2 (서울)
```

### 2-2. EFS (Elastic File System)

```
파일시스템명: fassto-herald-storage
리전: ap-northeast-2 (서울)
성능 모드: General Purpose
처리량 모드: Bursting
암호화: 활성화 (AWS 관리형 키)

액세스 포인트:
  - 경로: /fassto-herald
  - POSIX 사용자: UID 1001, GID 1001
  - 루트 디렉토리 권한: 0755

마운트 타겟:
  - EKS 워커 노드가 위치한 서브넷에 각각 생성
  - 보안그룹: EKS 노드 보안그룹에서 NFS(2049) 허용
```

> **EFS 용도**: SQLite DB 파일(`data.db`) + 스크린샷 업로드 파일(`uploads/`)을 영속 저장합니다.
> Pod 재시작/재배포 시에도 데이터가 유지됩니다.

### 2-3. EKS 네임스페이스 + Istio

```
기존 Fassto EKS 클러스터에 네임스페이스 생성:
  - fassto-herald
  - Istio sidecar injection 활성화: kubectl label ns fassto-herald istio-injection=enabled

필수 구성 요소 (기존 클러스터에 설치 확인):
  - Istio (IngressGateway, VirtualService)
  - Argo Rollouts Controller
  - EFS CSI Driver (aws-efs-csi-driver)
```

### 2-4. ALB + Istio IngressGateway

```
ALB:
  - 리스너: HTTPS 443 (ACM 인증서 연결)
  - HTTP 80 → HTTPS 301 리다이렉트
  - 타겟: Istio IngressGateway Service (HTTP:80)
  - SSL 종료: ALB에서 수행, IngressGateway는 HTTP만 수신

라우팅:
  - ALB → Istio IngressGateway → VirtualService → app
```

### 2-5. Route 53

```
A 레코드 (Alias): herald.fassto.ai → ALB DNS
```

### 2-6. K8s Secrets

```
kubectl -n fassto-herald create secret generic herald-secrets \
  --from-literal=NEXTAUTH_SECRET='<랜덤 64자 문자열>' \
  --from-literal=JIRA_API_TOKEN='<JIRA API 토큰>' \
  --from-literal=ANTHROPIC_API_KEY='<Anthropic API 키>' \
  --from-literal=SLACK_BOT_TOKEN='<Slack Bot 토큰>' \
  --from-literal=SMTP_PASS='<Gmail 앱 비밀번호>'
```

### 2-7. 보안그룹

```
eks-node-sg (기존):
  - Outbound: EFS 보안그룹 2049 (NFS) 허용 추가
  - Outbound: HTTPS 443 (외부 API — JIRA, Anthropic, Slack, Gmail SMTP)

efs-sg:
  - Inbound: eks-node-sg에서 2049 허용
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

# 스토리지 디렉토리 (EFS 마운트 포인트)
RUN mkdir -p /app/storage/uploads && chown -R nextjs:nodejs /app/storage

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
prisma/data.db
public/uploads/
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

### 4-1. PersistentVolume + PersistentVolumeClaim (EFS)

```yaml
# k8s/efs-pv.yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: fassto-herald-efs-pv
spec:
  capacity:
    storage: 5Gi
  volumeMode: Filesystem
  accessModes:
    - ReadWriteOnce          # 단일 Pod만 쓰기 (SQLite)
  persistentVolumeReclaimPolicy: Retain
  storageClassName: efs-sc
  csi:
    driver: efs.csi.aws.com
    volumeHandle: fs-xxxxxxxxx::fsap-xxxxxxxxx   # EFS ID::AccessPoint ID
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: herald-storage
  namespace: fassto-herald
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: efs-sc
  resources:
    requests:
      storage: 5Gi
```

### 4-2. App Argo Rollout + Service

```yaml
# k8s/app.yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: app
  namespace: fassto-herald
spec:
  replicas: 1                # SQLite — 반드시 1개 유지
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
        - setWeight: 100     # SQLite 단일 Pod이므로 즉시 전환
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
          envFrom:
            - secretRef:
                name: herald-secrets
          volumeMounts:
            - name: storage
              mountPath: /app/storage
          resources:
            requests:
              cpu: 250m
              memory: 512Mi
            limits:
              cpu: 500m
              memory: 1Gi
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
      volumes:
        - name: storage
          persistentVolumeClaim:
            claimName: herald-storage
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

### 4-3. Istio Gateway + VirtualService

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
// src/lib/prisma.ts — 운영 환경 DB 경로
// EFS 마운트 경로: /app/storage/data.db
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
  --from-literal=NEXTAUTH_SECRET='<랜덤 64자>' \
  --from-literal=JIRA_API_TOKEN='<토큰>' \
  --from-literal=ANTHROPIC_API_KEY='<키>' \
  --from-literal=SLACK_BOT_TOKEN='<토큰>' \
  --from-literal=SMTP_PASS='<앱비밀번호>'

kubectl apply -f k8s/efs-pv.yaml
kubectl apply -f k8s/istio.yaml
kubectl apply -f k8s/app.yaml

# 3. DB 초기화 (Pod 내에서 실행)
kubectl -n fassto-herald exec deploy/app -- npx prisma db push
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
| `NEXTAUTH_SECRET` | Auth.js 시크릿 키 (64자+) | K8s Secret | O |
| `NEXTAUTH_URL` | 서비스 URL | env | O |
| `JIRA_BASE_URL` | Atlassian Cloud URL | env | O |
| `JIRA_API_TOKEN` | JIRA API 토큰 | K8s Secret | O |
| `JIRA_USER_EMAIL` | JIRA 서비스 계정 이메일 | env | O |
| `ANTHROPIC_API_KEY` | Anthropic API 키 | K8s Secret | O |
| `SLACK_BOT_TOKEN` | Slack Bot 토큰 | K8s Secret | O |
| `SMTP_USER` | Gmail 계정 | env | O |
| `SMTP_PASS` | Gmail 앱 비밀번호 | K8s Secret | O |

### 외부 API 접근 (Outbound HTTPS 443 필요)

| 서비스 | 도메인 | 용도 |
|--------|--------|------|
| JIRA | `fssuniverse.atlassian.net` | Release Note 티켓 조회 |
| Anthropic | `api.anthropic.com` | AI 텍스트 변환 |
| Slack | `slack.com` | 메시지 조회, 요청자 추출 |
| Gmail SMTP | `smtp.gmail.com:587` | 이메일 발송 |

---

## 7. 백업 전략

### EFS 자동 백업 (권장)

```
AWS Backup:
  - EFS 파일시스템에 대한 자동 백업 계획 생성
  - 주기: 매일 1회
  - 보존: 30일
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

## 9. 체크리스트

### 배포 전 — AWS 관리자

- [ ] ECR: 리포지토리 `fassto-herald` 생성
- [ ] EFS: 파일시스템 및 액세스 포인트 생성
- [ ] EKS: 네임스페이스 `fassto-herald` 생성 + Istio sidecar injection 활성화
- [ ] EKS: EFS CSI Driver, Istio, Argo Rollouts Controller 설치 확인
- [ ] ALB: Istio IngressGateway 연결 (HTTPS→HTTP 종료)
- [ ] Route 53: `herald.fassto.ai` A 레코드 → ALB
- [ ] 보안그룹: EKS 노드 → EFS NFS(2049) 허용
- [ ] ACM: `herald.fassto.ai` SSL 인증서

### 배포 전 — 개발자

- [ ] `next.config.ts`에 `output: "standalone"` 추가
- [ ] `Dockerfile` 생성
- [ ] `.dockerignore` 파일 생성
- [ ] `src/app/api/health/route.ts` 헬스체크 엔드포인트 추가
- [ ] `k8s/` 디렉토리에 매니페스트 파일 생성
- [ ] K8s Secret 생성 (`herald-secrets`)
- [ ] 로컬 Docker 빌드 테스트

### 배포 후

- [ ] `https://herald.fassto.ai/api/health` → `{"status":"ok"}`
- [ ] 로그인 정상 동작
- [ ] JIRA 릴리즈 URL → 초안 생성 동작
- [ ] 이메일 발송 동작
- [ ] 스크린샷 업로드 → EFS 영속 확인 (Pod 재시작 후 파일 존재 여부)
- [ ] EFS 백업 계획 설정
