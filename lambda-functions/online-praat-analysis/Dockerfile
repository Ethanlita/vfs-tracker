FROM public.ecr.aws/lambda/python:3.13 AS parselmouth-builder

# v2 默认算法需要尚未进入稳定版的 filtered autocorrelation。
# 从固定提交及其固定子模块构建，避免依赖会过期的 GitHub Actions artifact。
RUN dnf install -y git cmake gcc gcc-c++ make \
    && dnf clean all
ARG PARSELMOUTH_SOURCE_REPOSITORY
ARG PARSELMOUTH_SOURCE_COMMIT
RUN test -n "${PARSELMOUTH_SOURCE_REPOSITORY}" \
    && test -n "${PARSELMOUTH_SOURCE_COMMIT}"
WORKDIR /tmp/parselmouth
RUN git clone --filter=blob:none --no-checkout "${PARSELMOUTH_SOURCE_REPOSITORY}" . \
    && git checkout --detach "${PARSELMOUTH_SOURCE_COMMIT}" \
    && git submodule update --init --recursive
RUN cmake -S . -B build_dependencies \
    && cmake --build build_dependencies --target praat -j 2
RUN SKBUILD_CMAKE_ARGS="-DPREBUILT_DEPENDENCIES=/tmp/parselmouth/build_dependencies" \
    CMAKE_BUILD_PARALLEL_LEVEL=4 \
    pip wheel --no-deps . --wheel-dir /tmp/wheels

FROM public.ecr.aws/lambda/python:3.13 AS prepared

# 仅系统依赖（缓慢层放前面，减少重建）
RUN dnf install -y libsndfile gcc g++ make \
    && dnf clean all

# 依赖安装（requirements.txt 变化才重建）
COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt

# 复制源代码（代码改动触发这一层+后续层重建）
COPY . ${LAMBDA_TASK_ROOT}

# 仅安装固定源码 wheel，并验证生产代码所需的 Praat 命令。
COPY --from=parselmouth-builder /tmp/wheels/*.whl /tmp/parselmouth-wheel/
RUN pip install /tmp/parselmouth-wheel/*.whl \
    && rm -rf /tmp/parselmouth-wheel \
    && python -c "import numpy as np, parselmouth; from parselmouth.praat import call; sr=16000; t=np.arange(sr)/sr; sound=parselmouth.Sound(np.sin(2*np.pi*180*t), sr); call(sound, 'To Pitch (filtered autocorrelation)', 0.01, 50, 800, 15, 'no', 0.03, 0.09, 0.5, 0.055, 0.35, 0.14); print(f'[INFO] Parselmouth={parselmouth.__version__}, Praat={getattr(parselmouth, \"PRAAT_VERSION\", \"<missing>\")}')"

# 镜像只有在完整声学与处理程序测试通过后才能进入运行阶段。
# 测试依赖保留在独立阶段，避免把 pytest 写入生产镜像。
FROM prepared AS test
RUN pip install --no-cache-dir -r requirements-test.txt \
    && python -m pytest tests \
    && touch /tmp/python-tests-passed

FROM prepared AS runtime
COPY --from=test /tmp/python-tests-passed /tmp/python-tests-passed
# 测试源码参与前一阶段验证，但不保留在 Lambda 的最终可见文件系统中。
RUN rm -rf tests .pytest_cache

# Lambda 入口
CMD [ "handler.handler" ]
