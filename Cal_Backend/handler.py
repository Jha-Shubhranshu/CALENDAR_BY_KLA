from mangum import Mangum
from Cal_Backend import app

# This is the handler that AWS Lambda will call
# lifespan="on" ensures your init_db() runs on cold starts
handler = Mangum(app, lifespan="off")
