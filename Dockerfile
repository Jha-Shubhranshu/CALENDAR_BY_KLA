FROM public.ecr.aws/lambda/python:3.11

COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r requirements.txt --target ${LAMBDA_TASK_ROOT}
COPY Cal_Backend/ ${LAMBDA_TASK_ROOT}/Cal_Backend/
CMD ["Cal_Backend.handler.handler"]