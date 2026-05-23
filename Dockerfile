FROM public.ecr.aws/lambda/python:3.12

# Install OS-level deps if any of your wheels need them (libpq for asyncpg builds from sdist, etc.)
# RUN dnf install -y gcc postgresql-devel && dnf clean all

COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r requirements.txt --target ${LAMBDA_TASK_ROOT}

COPY Cal_Backend/ ${LAMBDA_TASK_ROOT}/Cal_Backend/

CMD ["Cal_Backend.handler.handler"]