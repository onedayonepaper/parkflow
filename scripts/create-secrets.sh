#!/bin/bash

# ============================================================================
# ParkFlow Docker Secrets 생성 스크립트
# ============================================================================
# Docker Swarm에서 사용할 시크릿을 생성합니다.
#
# 사용법:
#   ./scripts/create-secrets.sh              # 모든 시크릿 생성 (기존 것 유지)
#   ./scripts/create-secrets.sh --force      # 기존 시크릿 삭제 후 재생성
#   ./scripts/create-secrets.sh --delete     # 모든 시크릿 삭제
#   ./scripts/create-secrets.sh --list       # 시크릿 목록 확인
#
# 참고:
#   - Docker Swarm이 초기화되어 있어야 합니다: docker swarm init
#   - 생성된 시크릿은 Docker가 암호화하여 관리합니다
# ============================================================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 시크릿 이름 목록
SECRETS=(
    "jwt_secret"
    "device_api_key"
    "kiosk_api_key"
    "toss_secret_key"
    "toss_client_key"
    "toss_webhook_secret"
)

# 헬프 메시지
show_help() {
    echo "ParkFlow Docker Secrets 관리"
    echo ""
    echo "사용법:"
    echo "  $0              모든 시크릿 생성 (기존 것 유지)"
    echo "  $0 --force      기존 시크릿 삭제 후 재생성"
    echo "  $0 --delete     모든 시크릿 삭제"
    echo "  $0 --list       시크릿 목록 확인"
    echo "  $0 --help       이 도움말 표시"
    echo ""
    echo "시크릿 목록:"
    for secret in "${SECRETS[@]}"; do
        echo "  - $secret"
    done
}

# 랜덤 문자열 생성
generate_random_string() {
    local length=${1:-32}
    openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c "$length"
}

# Docker Swarm 확인
check_swarm() {
    if ! docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null | grep -q "active"; then
        echo -e "${RED}오류: Docker Swarm이 활성화되어 있지 않습니다.${NC}"
        echo ""
        echo "Swarm을 초기화하려면 다음 명령을 실행하세요:"
        echo -e "  ${BLUE}docker swarm init${NC}"
        exit 1
    fi
}

# 시크릿 존재 여부 확인
secret_exists() {
    docker secret inspect "$1" &>/dev/null
}

# 시크릿 생성
create_secret() {
    local name=$1
    local value=$2

    if secret_exists "$name"; then
        echo -e "${YELLOW}스킵: $name (이미 존재)${NC}"
        return 0
    fi

    echo "$value" | docker secret create "$name" - &>/dev/null
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}생성됨: $name${NC}"
    else
        echo -e "${RED}실패: $name${NC}"
        return 1
    fi
}

# 시크릿 삭제
delete_secret() {
    local name=$1

    if ! secret_exists "$name"; then
        echo -e "${YELLOW}스킵: $name (존재하지 않음)${NC}"
        return 0
    fi

    docker secret rm "$name" &>/dev/null
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}삭제됨: $name${NC}"
    else
        echo -e "${RED}삭제 실패: $name (사용 중인 서비스가 있을 수 있음)${NC}"
        return 1
    fi
}

# 모든 시크릿 삭제
delete_all_secrets() {
    check_swarm
    echo -e "${YELLOW}모든 ParkFlow 시크릿을 삭제합니다...${NC}"
    echo ""

    for secret in "${SECRETS[@]}"; do
        delete_secret "$secret"
    done

    echo ""
    echo -e "${GREEN}완료!${NC}"
}

# 시크릿 목록 표시
list_secrets() {
    check_swarm
    echo -e "${BLUE}현재 Docker 시크릿 목록:${NC}"
    echo ""
    docker secret ls
    echo ""
    echo -e "${BLUE}ParkFlow 시크릿 상태:${NC}"
    for secret in "${SECRETS[@]}"; do
        if secret_exists "$secret"; then
            echo -e "  ${GREEN}✓${NC} $secret"
        else
            echo -e "  ${RED}✗${NC} $secret"
        fi
    done
}

# 시크릿 생성 (메인 함수)
create_all_secrets() {
    local force=$1
    check_swarm

    echo -e "${BLUE}ParkFlow Docker 시크릿 생성${NC}"
    echo ""

    # 강제 재생성 모드
    if [ "$force" = "true" ]; then
        echo -e "${YELLOW}기존 시크릿을 삭제합니다...${NC}"
        for secret in "${SECRETS[@]}"; do
            delete_secret "$secret" 2>/dev/null || true
        done
        echo ""
    fi

    echo -e "${BLUE}시크릿 생성 중...${NC}"
    echo ""

    # 사용자 입력 받기 또는 자동 생성
    for secret in "${SECRETS[@]}"; do
        if secret_exists "$secret" && [ "$force" != "true" ]; then
            echo -e "${YELLOW}스킵: $secret (이미 존재)${NC}"
            continue
        fi

        # 기존 환경변수 확인
        local env_var_name=$(echo "$secret" | tr '[:lower:]' '[:upper:]')
        local existing_value=${!env_var_name}

        if [ -n "$existing_value" ]; then
            # 환경변수에서 값 사용
            echo -n "$existing_value" | docker secret create "$secret" - &>/dev/null
            echo -e "${GREEN}생성됨: $secret (환경변수에서)${NC}"
        else
            # 자동 생성
            local new_value
            case $secret in
                jwt_secret)
                    new_value=$(generate_random_string 64)
                    ;;
                device_api_key|kiosk_api_key)
                    new_value=$(generate_random_string 32)
                    ;;
                toss_secret_key|toss_client_key|toss_webhook_secret)
                    # TossPayments 키는 사용자가 직접 설정해야 함
                    new_value="PLACEHOLDER_REPLACE_ME"
                    ;;
                *)
                    new_value=$(generate_random_string 32)
                    ;;
            esac

            echo "$new_value" | docker secret create "$secret" - &>/dev/null
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}생성됨: $secret${NC}"
            else
                echo -e "${RED}실패: $secret${NC}"
            fi
        fi
    done

    echo ""
    echo -e "${GREEN}완료!${NC}"
    echo ""
    echo -e "${YELLOW}참고:${NC}"
    echo "  - toss_secret_key, toss_client_key, toss_webhook_secret는"
    echo "    실제 TossPayments 값으로 업데이트해야 합니다."
    echo ""
    echo "  시크릿 업데이트 방법:"
    echo "  1. 기존 시크릿 삭제: docker secret rm toss_secret_key"
    echo "  2. 새 시크릿 생성: echo 'YOUR_KEY' | docker secret create toss_secret_key -"
    echo ""
    echo "  또는 이 스크립트를 다시 실행하세요:"
    echo "  TOSS_SECRET_KEY='your_key' $0 --force"
}

# 메인
main() {
    case "${1:-}" in
        --help|-h)
            show_help
            ;;
        --force|-f)
            create_all_secrets true
            ;;
        --delete|-d)
            delete_all_secrets
            ;;
        --list|-l)
            list_secrets
            ;;
        "")
            create_all_secrets false
            ;;
        *)
            echo -e "${RED}알 수 없는 옵션: $1${NC}"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

main "$@"
