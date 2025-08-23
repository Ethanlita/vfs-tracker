FROM public.ecr.aws/lambda/python:3.13

# 仅系统依赖（缓慢层放前面，减少重建）
RUN dnf install -y libsndfile gcc g++ make \
    && dnf clean all

# 依赖安装（requirements.txt 变化才重建）
COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt

# 复制源代码（代码改动触发这一层+后续层重建）
COPY . ${LAMBDA_TASK_ROOT}

# Lambda 入口
CMD [ "handler.handler" ]
