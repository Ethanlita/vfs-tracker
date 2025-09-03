#!/bin/bash
# 成本最优化的.wav文件管理方案

BUCKET_NAME="your-bucket-name"
PROFILE="default"

setup_cost_optimized_lifecycle() {
    echo "=== S3 .wav文件成本优化生命周期策略 ==="

    # 获取用户输入
    read -p "请输入.wav文件保留天数 (默认30): " days_input
    DAYS_TO_KEEP=${days_input:-30}

    read -p "请输入.wav文件路径前缀 (如 audio/, 留空表示整个存储桶): " prefix_input
    PREFIX=${prefix_input:-""}

    # 计算过渡时间点
    IA_DAYS=$((DAYS_TO_KEEP > 14 ? 7 : DAYS_TO_KEEP / 2))
    GLACIER_DAYS=$((DAYS_TO_KEEP > 21 ? 14 : DAYS_TO_KEEP * 2 / 3))

    echo ""
    echo "配置摘要："
    echo "- 存储桶: $BUCKET_NAME"
    echo "- 路径前缀: ${PREFIX:-"(整个存储桶)"}"
    echo "- 保留时间: $DAYS_TO_KEEP 天"
    echo "- 成本优化: Standard($IA_DAYS天) → IA($((GLACIER_DAYS-IA_DAYS))天) → Glacier($((DAYS_TO_KEEP-GLACIER_DAYS))天) → 删除"
    echo ""

    # 创建优化策略
    cat > cost-optimized-policy.json << EOF
{
    "Rules": [
        {
            "ID": "CostOptimizedWavFiles",
            "Status": "Enabled",
            "Filter": {
                "Prefix": "$PREFIX"
            },
            "Transitions": [
                {
                    "Days": $IA_DAYS,
                    "StorageClass": "STANDARD_IA"
                },
                {
                    "Days": $GLACIER_DAYS,
                    "StorageClass": "GLACIER"
                }
            ],
            "Expiration": {
                "Days": $DAYS_TO_KEEP
            },
            "NoncurrentVersionTransitions": [
                {
                    "NoncurrentDays": 1,
                    "StorageClass": "STANDARD_IA"
                }
            ],
            "NoncurrentVersionExpiration": {
                "NoncurrentDays": 7
            },
            "AbortIncompleteMultipartUpload": {
                "DaysAfterInitiation": 1
            }
        }
    ]
}
EOF

    # 应用策略
    aws s3api put-bucket-lifecycle-configuration \
        --bucket $BUCKET_NAME \
        --lifecycle-configuration file://cost-optimized-policy.json \
        --profile $PROFILE

    if [ $? -eq 0 ]; then
        echo "✅ 成本优化生命周期策略创建成功！"

        # 计算预估成本节省
        calculate_cost_savings

        # 设置监控
        setup_monitoring
    else
        echo "❌ 策略创建失败"
    fi

    rm -f cost-optimized-policy.json
}

calculate_cost_savings() {
    echo ""
    echo "=== 预估成本节省 ==="
    echo "与手动删除相比的优势："
    echo "✅ 无API调用费用 (每1000次DELETE请求 \$0.0004)"
    echo "✅ 无Lambda执行费用"
    echo "✅ 自动存储类别转换节省存储费用"
    echo "✅ 无需维护定时任务"
    echo "✅ 减少意外删除风险"
}

setup_monitoring() {
    echo ""
    echo "=== 设置监控 ==="

    # 创建CloudWatch告警监控存储使用量
    aws cloudwatch put-metric-alarm \
        --alarm-name "S3-${BUCKET_NAME}-StorageUsage" \
        --alarm-description "Monitor S3 bucket storage usage" \
        --metric-name BucketSizeBytes \
        --namespace AWS/S3 \
        --statistic Average \
        --period 86400 \
        --threshold 1000000000 \
        --comparison-operator GreaterThanThreshold \
        --dimensions Name=BucketName,Value=$BUCKET_NAME Name=StorageType,Value=StandardStorage \
        --evaluation-periods 1 \
        --profile $PROFILE 2>/dev/null || echo "⚠️  CloudWatch告警创建失败（可选功能）"

    echo "📊 建议定期检查存储桶指标以优化策略"
}

# 验证和管理现有策略
manage_lifecycle_policies() {
    echo "=== 生命周期策略管理 ==="
    echo "1. 查看当前策略"
    echo "2. 更新策略"
    echo "3. 删除策略"
    echo "4. 返回主菜单"

    read -p "请选择操作 (1-4): " choice

    case $choice in
        1)
            aws s3api get-bucket-lifecycle-configuration \
                --bucket $BUCKET_NAME \
                --profile $PROFILE \
                --output table 2>/dev/null || echo "当前无生命周期策略"
            ;;
        2)
            setup_cost_optimized_lifecycle
            ;;
        3)
            read -p "确认删除生命周期策略？(y/N): " confirm
            if [ "$confirm" = "y" ]; then
                aws s3api delete-bucket-lifecycle \
                    --bucket $BUCKET_NAME \
                    --profile $PROFILE
                echo "✅ 生命周期策略已删除"
            fi
            ;;
        4)
            return
            ;;
    esac
}

# 主菜单
main_menu() {
    while true; do
        echo ""
        echo "=== S3 .wav文件成本优化管理 ==="
        echo "1. 创建成本优化生命周期策略"
        echo "2. 管理现有策略"
        echo "3. 查看存储桶统计"
        echo "4. 退出"

        read -p "请选择操作 (1-4): " choice

        case $choice in
            1)
                setup_cost_optimized_lifecycle
                ;;
            2)
                manage_lifecycle_policies
                ;;
            3)
                echo "存储桶统计信息："
                aws s3 ls s3://$BUCKET_NAME --recursive --human-readable --summarize --profile $PROFILE | tail -2
                ;;
            4)
                echo "退出程序"
                break
                ;;
            *)
                echo "无效选项"
                ;;
        esac
    done
}

# 运行主程序
main_menu
