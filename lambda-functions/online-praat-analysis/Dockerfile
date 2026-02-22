FROM public.ecr.aws/lambda/python:3.13

# 仅系统依赖（缓慢层放前面，减少重建）
RUN dnf install -y libsndfile gcc g++ make \
    && dnf clean all

# 依赖安装（requirements.txt 变化才重建）
COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt

# 复制源代码（代码改动触发这一层+后续层重建）
COPY . ${LAMBDA_TASK_ROOT}

# 可选：在 CI 中安装 Parselmouth dev wheel（用于提前使用新 Praat 能力）
ARG PARSELMOUTH_DEV_WHEEL_PATH=""
ARG PARSELMOUTH_DEV_WHEEL_SHA256=""
RUN if [ -n "${PARSELMOUTH_DEV_WHEEL_PATH}" ]; then \
            WHEEL_FILE="${LAMBDA_TASK_ROOT}/${PARSELMOUTH_DEV_WHEEL_PATH}"; \
            if [ ! -f "${WHEEL_FILE}" ]; then \
                echo "[ERROR] Dev wheel not found: ${WHEEL_FILE}"; \
                exit 1; \
            fi; \
            if [ -n "${PARSELMOUTH_DEV_WHEEL_SHA256}" ]; then \
                echo "${PARSELMOUTH_DEV_WHEEL_SHA256}  ${WHEEL_FILE}" | sha256sum -c -; \
            fi; \
            pip install --force-reinstall "${WHEEL_FILE}"; \
            python - <<'PY' \
import parselmouth \
print(f"[INFO] Parselmouth={parselmouth.__version__}, Praat={getattr(parselmouth, 'PRAAT_VERSION', '<missing>')}") \
PY \
        ; fi

# Lambda 入口
CMD [ "handler.handler" ]
