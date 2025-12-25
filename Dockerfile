# Dockerfile for containerized Lambda (optional)
FROM public.ecr.aws/lambda/nodejs:22

# Copy package files first for better layer caching
COPY package*.json ${LAMBDA_TASK_ROOT}/

# Install production dependencies
RUN npm ci --production

# Copy layer code
COPY src/layers/shared/nodejs/ ${LAMBDA_TASK_ROOT}/nodejs/

# Copy function code
COPY src/lambdas/create-todo/ ${LAMBDA_TASK_ROOT}/
COPY src/lambdas/get-todo/ ${LAMBDA_TASK_ROOT}/
COPY src/lambdas/list-todos/ ${LAMBDA_TASK_ROOT}/
COPY src/lambdas/update-todo/ ${LAMBDA_TASK_ROOT}/
COPY src/lambdas/delete-todo/ ${LAMBDA_TASK_ROOT}/
COPY src/lambdas/ai-task-processor/ ${LAMBDA_TASK_ROOT}/
COPY src/lambdas/stream-consumer/ ${LAMBDA_TASK_ROOT}/

# Set handler
CMD [ "index.handler" ]
