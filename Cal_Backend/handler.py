import logging
import sys
import traceback

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    from mangum import Mangum
    from Cal_Backend import app

    # This is the handler that AWS Lambda will call
    # lifespan="auto" is generally safer than "on" while still supporting lifespan if possible
    handler = Mangum(app, lifespan="auto")
    logger.info("Mangum handler initialized successfully.")

except Exception as e:
    logger.error(f"CRITICAL: Failed to initialize application: {str(e)}")
    traceback.print_exc()
    # If we fail here, the Lambda will fail to start, returning a 503 or 502 to API Gateway.
    raise e
