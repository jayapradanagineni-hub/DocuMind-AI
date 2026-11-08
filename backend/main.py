
# ==========================================
# DOCUMIND AI - FASTAPI BACKEND
# ==========================================

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from pypdf import PdfReader
from io import BytesIO

from database import SessionLocal, Conversation, Message
from rag import process_document, ask_question

# ==========================================
# FASTAPI APPLICATION
# ==========================================

app = FastAPI(title="DocuMind AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# REQUEST MODELS
# ==========================================

class QuestionRequest(BaseModel):
    question: str


class ConversationRequest(BaseModel):
    title: str = "New Conversation"


class MessageRequest(BaseModel):
    role: str
    content: str


# ==========================================
# HOME
# ==========================================

@app.get("/")
def home():
    return {
        "message": "Welcome to DocuMind AI",
        "status": "running"
    }


# ==========================================
# HEALTH CHECK
# ==========================================

@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


# ==========================================
# PDF UPLOAD
# ==========================================

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are allowed"
        )

    contents = await file.read()

    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="PDF size must be below 10 MB"
        )

    try:
        pdf_reader = PdfReader(BytesIO(contents))

        extracted_text = ""

        for page in pdf_reader.pages:
            page_text = page.extract_text() or ""
            extracted_text += page_text + "\n"

        if not extracted_text.strip():
            raise HTTPException(
                status_code=400,
                detail="No readable text found in this PDF"
            )

        chunks = process_document(extracted_text)

        return {
            "message": f"Successfully uploaded {file.filename}!",
            "filename": file.filename,
            "chunks": chunks
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"PDF processing failed: {str(e)}"
        )


# ==========================================
# ASK GEMINI AI
# ==========================================

@app.post("/ask")
def ask(request: QuestionRequest):

    try:
        answer = ask_question(request.question)

        return {
            "answer": answer
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI response failed: {str(e)}"
        )


# ==========================================
# CREATE NEW CONVERSATION
# ==========================================

@app.post("/conversations")
def create_conversation(request: ConversationRequest):

    db = SessionLocal()

    try:
        conversation = Conversation(
            title=request.title
        )

        db.add(conversation)
        db.commit()
        db.refresh(conversation)

        return {
            "id": conversation.id,
            "title": conversation.title
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        db.close()


# ==========================================
# GET ALL CONVERSATIONS
# ==========================================

@app.get("/conversations")
def get_conversations():

    db = SessionLocal()

    try:
        conversations = (
            db.query(Conversation)
            .order_by(Conversation.id.desc())
            .all()
        )

        return [
            {
                "id": conversation.id,
                "title": conversation.title
            }
            for conversation in conversations
        ]

    finally:
        db.close()


# ==========================================
# GET CONVERSATION WITH MESSAGES
# ==========================================

@app.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: int):

    db = SessionLocal()

    try:
        conversation = (
            db.query(Conversation)
            .filter(Conversation.id == conversation_id)
            .first()
        )

        if not conversation:
            raise HTTPException(
                status_code=404,
                detail="Conversation not found"
            )

        return {
            "id": conversation.id,
            "title": conversation.title,
            "messages": [
                {
                    "id": message.id,
                    "role": message.role,
                    "content": message.content
                }
                for message in conversation.messages
            ]
        }

    finally:
        db.close()


# ==========================================
# SAVE MESSAGE
# ==========================================

@app.post("/conversations/{conversation_id}/messages")
def save_message(
    conversation_id: int,
    request: MessageRequest
):

    db = SessionLocal()

    try:
        conversation = (
            db.query(Conversation)
            .filter(Conversation.id == conversation_id)
            .first()
        )

        if not conversation:
            raise HTTPException(
                status_code=404,
                detail="Conversation not found"
            )

        message = Message(
            conversation_id=conversation_id,
            role=request.role,
            content=request.content
        )

        db.add(message)
        db.commit()
        db.refresh(message)

        return {
            "message": "Message saved successfully",
            "id": message.id
        }

    except HTTPException:
        raise

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        db.close()


# ==========================================
# DELETE CONVERSATION
# ==========================================

@app.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: int):

    db = SessionLocal()

    try:
        conversation = (
            db.query(Conversation)
            .filter(Conversation.id == conversation_id)
            .first()
        )

        if not conversation:
            raise HTTPException(
                status_code=404,
                detail="Conversation not found"
            )

        db.delete(conversation)
        db.commit()

        return {
            "message": "Conversation deleted successfully"
        }

    finally:
        db.close()
