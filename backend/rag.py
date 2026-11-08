import os

from dotenv import load_dotenv
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

llm = ChatGoogleGenerativeAI(
    model="gemini-3.8-flash",
    google_api_key=GEMINI_API_KEY,
    temperature=0.2
)

vector_store = None


def process_document(text):

    global vector_store

    document = Document(page_content=text)

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=100
    )

    chunks = splitter.split_documents([document])

    vector_store = FAISS.from_documents(
        chunks,
        embeddings
    )

    return len(chunks)


def ask_question(question):

    if vector_store is None:
        return "Please upload a document first."

    retriever = vector_store.as_retriever(
        search_kwargs={"k": 3}
    )

    relevant_docs = retriever.invoke(question)

    context = "\n\n".join(
        doc.page_content for doc in relevant_docs
    )

    prompt = ChatPromptTemplate.from_template("""
You are an intelligent document assistant.

Answer the question using only the provided context.
If the answer is unavailable, clearly say that it is not
found in the uploaded document.

Context:
{context}

Question:
{question}

Answer:
""")

    chain = (
        prompt
        | llm
        | StrOutputParser()
    )

    answer = chain.invoke({
        "context": context,
        "question": question
    })

    return answer