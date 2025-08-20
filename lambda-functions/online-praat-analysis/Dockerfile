FROM public.ecr.aws/lambda/python:3.13

# Install system dependencies
RUN dnf install -y libsndfile gcc g++ make \
    && dnf clean all

# Copy requirements.txt and install Python dependencies
COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt

# Copy application code
COPY . ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler (handler.py::handler)
CMD [ "handler.handler" ]
