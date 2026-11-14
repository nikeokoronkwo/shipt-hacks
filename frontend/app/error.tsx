"use client";
export default function Error({ reset }: { reset: () => void }) { return <section className="container-wide py-24 text-center"><h1 className="page-title">A bump in the road.</h1><p className="my-6 text-sm text-muted">Something went wrong. Please try again.</p><button onClick={reset} className="btn btn-primary">Try again</button></section>; }
