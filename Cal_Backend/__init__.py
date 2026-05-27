# uvicorn __init__:app --host 127.0.0.1 --port 8000 --reload       

from fastapi import FastAPI
from contextlib import asynccontextmanager
from Cal_Backend.auth.routes import auth_router
from Cal_Backend.Note.route import note_router
from Cal_Backend.Label.route import label_router
from Cal_Backend.Conversations.route import conversation_router
from Cal_Backend.Project.route import project_router
from Cal_Backend.Calendar.route import calendar_router
import traceback
from fastapi.responses import PlainTextResponse
from fastapi import Request

# from src.books.routes import book_router
# from src.reviews.routes import review_router
# from src.tags.routes import tags_router
from .errors import register_all_errors
from .middleware import register_middleware
from Cal_Backend.db.main import init_db


from Cal_Backend.user_data_import.route import Json_router

version = "v1"

description = """
Calendar with notes
    """

version_prefix =f"/api/{version}"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    yield
    # Shutdown (if needed)


app = FastAPI(
    title="CalendarByKla",
    description=description,
    version=version,
    license_info={"name": "MIT License", "url": "https://opensource.org/license/mit"},
    contact={
        "name": "Authority",
        "email": "authoritydevelopmentdomain@gmail.com",
    },
    terms_of_service="httpS://example.com/tos",
    openapi_url=f"{version_prefix}/openapi.json",
    docs_url=f"{version_prefix}/docs",
    redoc_url=f"{version_prefix}/redoc",
    lifespan=lifespan

)

register_all_errors(app)

register_middleware(app)

@app.middleware("http")
async def ultra_debug_logging(request: Request, call_next):
    print("\n" + "=" * 100)
    print("REQUEST RECEIVED")
    print("METHOD:", request.method)
    print("PATH:", request.url.path)
    print("URL:", str(request.url))

    print("\nHEADERS:")
    for k, v in request.headers.items():
        print(f"{k}: {v}")

    try:
        body = await request.body()
        print("\nBODY LENGTH:", len(body))
        print("BODY PREVIEW:", body[:500])
    except Exception as e:
        print("BODY READ ERROR:", str(e))

    print("=" * 100)

    response = await call_next(request)

    print("\nRESPONSE STATUS:", response.status_code)

    print("\nRESPONSE HEADERS:")
    for k, v in response.headers.items():
        print(f"{k}: {v}")

    print("=" * 100 + "\n")

    return response



print("Registered middlewares:", [m.cls.__name__ for m in app.user_middleware])

app.include_router(Json_router, prefix=f"{version_prefix}/ArjunJson", tags=["Json"])
# app.include_router(book_router, prefix=f"{version_prefix}/books", tags=["books"])
app.include_router(auth_router, prefix=f"{version_prefix}/auth", tags=["auth"])
app.include_router(note_router, prefix=f"{version_prefix}/notes", tags=["note"])
app.include_router(label_router, prefix=f"{version_prefix}/labels", tags=["label"])
app.include_router(conversation_router, prefix="/api/v1/conversations", tags=["conversations"])
app.include_router(project_router, prefix="/api/v1/projects", tags=["projects"])
app.include_router(calendar_router, prefix="/api/v1/calendar", tags=["calendar"])

# app.include_router(review_router, prefix=f"{version_prefix}/reviews", tags=["reviews"])
# app.include_router(tags_router, prefix=f"{version_prefix}/tags", tags=["tags"])
