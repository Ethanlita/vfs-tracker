FROM public.ecr.aws/lambda/python:3.13

# 仅系统依赖（缓慢层放前面，减少重建）
RUN dnf install -y libsndfile gcc g++ make \
    && dnf clean all

# 依赖安装（requirements.txt 变化才重建）
COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt

# 复制源代码（代码改动触发这一层+后续层重建）
COPY . ${LAMBDA_TASK_ROOT}

# 动态构建信息（每次传入新 build arg 时仅刷新这一层）
ARG BUILD_TIMESTAMP="unknown"
ARG GIT_SHA="unknown"
LABEL build.timestamp="${BUILD_TIMESTAMP}" build.git_sha="${GIT_SHA}"
ENV APP_BUILD_TIMESTAMP="${BUILD_TIMESTAMP}" \
    APP_BUILD_GIT_SHA="${GIT_SHA}"
RUN echo "BUILD_TIMESTAMP=${BUILD_TIMESTAMP}\nGIT_SHA=${GIT_SHA}" > ${LAMBDA_TASK_ROOT}/build-info.txt

# Lambda 入口
CMD [ "handler.handler" ]
