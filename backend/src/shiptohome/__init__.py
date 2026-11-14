def main() -> None:
    """Run the development API through the package entry point."""
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
