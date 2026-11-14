"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { authClient } from "@/lib/auth-client";
import {
  initializeDriver,
  listShelters,
  requestRide,
  type RideCreated,
  type Shelter,
} from "@/lib/api";

type Notice = { tone: "error" | "success"; text: string } | null;

export default function Home() {
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [loadingShelters, setLoadingShelters] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-up");
  const [submitting, setSubmitting] = useState(false);
  const [ride, setRide] = useState<RideCreated | null>(null);

  useEffect(() => {
    listShelters()
      .then(setShelters)
      .catch((error: unknown) =>
        setNotice({
          tone: "error",
          text:
            error instanceof Error
              ? `${error.message} Start the FastAPI service on port 8000.`
              : "Could not reach the shelter service.",
        }),
      )
      .finally(() => setLoadingShelters(false));
  }, []);

  const totalOpenBeds = useMemo(
    () => shelters.reduce((total, shelter) => total + shelter.available_beds, 0),
    [shelters],
  );
  const userRole = (session?.user as { role?: string } | undefined)?.role;

  async function handleAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "");
    const password = String(values.get("password") ?? "");

    const result =
      authMode === "sign-up"
        ? await authClient.signUp.email({
            name: String(values.get("name") ?? ""),
            email,
            password,
          })
        : await authClient.signIn.email({ email, password });
    setSubmitting(false);
    if (result.error) {
      setNotice({ tone: "error", text: result.error.message ?? "Authentication failed." });
      return;
    }
    setNotice({
      tone: "success",
      text:
        authMode === "sign-up"
          ? "Your driver account is ready. Add a phone number to activate your profile."
          : "Welcome back.",
    });
  }

  async function handleDriverSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);
    try {
      const values = new FormData(event.currentTarget);
      await initializeDriver(String(values.get("phone") ?? ""));
      setNotice({
        tone: "success",
        text: "Driver profile saved. A super administrator can now verify your account.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not save driver profile.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);
    try {
      const values = new FormData(event.currentTarget);
      const created = await requestRide({
        first_name: String(values.get("firstName") ?? ""),
        last_name: String(values.get("lastName") ?? ""),
        pickup_address: String(values.get("pickup") ?? ""),
        shelter_id: Number(values.get("shelterId")),
      });
      setRide(created);
      setNotice({
        tone: "success",
        text: "Ride request created. Save the private tracking token below.",
      });
      event.currentTarget.reset();
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not request a ride.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="ShelterConnect home">
          <span className="brand-mark">S</span>
          <span>ShelterConnect</span>
        </a>
        <div className="connection-pill">
          <span className="status-dot" />
          <span>Live shelter network</span>
        </div>
        {sessionLoading ? null : session ? (
          <button className="quiet-button" onClick={() => authClient.signOut()}>
            Sign out
          </button>
        ) : (
          <a className="quiet-button" href="#driver-access">
            Driver access
          </a>
        )}
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Birmingham · Demo network</p>
          <h1>A safe place should be <em>reachable.</em></h1>
          <p className="hero-description">
            Find a welcoming shelter, request a ride, and keep the details in your hands.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#ride-request">
              Request a ride <span aria-hidden="true">→</span>
            </a>
            <a className="text-link" href="#shelters">
              Browse shelters
            </a>
          </div>
        </div>
        <aside className="availability-card" aria-label="Current availability">
          <p>Tonight&apos;s opening</p>
          <strong>{loadingShelters ? "—" : totalOpenBeds}</strong>
          <span>demo beds reported open</span>
          <div className="availability-rule" />
          <small>Availability is community-reported and not an admission guarantee.</small>
        </aside>
      </section>

      {notice && (
        <div className={`notice notice-${notice.tone}`} role="status">
          {notice.text}
        </div>
      )}

      <section className="shelter-section" id="shelters" aria-labelledby="shelters-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Shelter availability</p>
            <h2 id="shelters-heading">A few doors are open.</h2>
          </div>
          <p>Updated by participating shelters. Call ahead when possible.</p>
        </div>
        <div className="shelter-grid">
          {loadingShelters ? (
            <p className="loading-copy">Checking availability…</p>
          ) : (
            shelters.map((shelter, index) => (
              <article className="shelter-card" key={shelter.id}>
                <span className="card-index">0{index + 1}</span>
                <div className="bed-count">
                  <strong>{shelter.available_beds}</strong>
                  <span>reported beds</span>
                </div>
                <h3>{shelter.name}</h3>
                <p>{shelter.address}</p>
                <ul>
                  {shelter.services.map((service) => (
                    <li key={service}>{service}</li>
                  ))}
                </ul>
                <span className={shelter.food_available ? "meal-tag" : "meal-tag muted"}>
                  {shelter.food_available ? "Meals available" : "Ask about meals"}
                </span>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="request-layout" id="ride-request">
        <div className="request-intro">
          <p className="eyebrow">Transportation request</p>
          <h2>We&apos;ll connect you with a verified volunteer.</h2>
          <p>
            You do not need an account. We only ask for what a driver needs to find you.
          </p>
          <div className="step-list" aria-label="How ride tracking works">
            <span><b>01</b> Share a pickup point</span>
            <span><b>02</b> Choose a destination</span>
            <span><b>03</b> Save your private token</span>
          </div>
        </div>
        <form className="ride-form" onSubmit={handleRide}>
          <div className="field-row">
            <label>
              First name
              <input name="firstName" required autoComplete="given-name" placeholder="Jordan" />
            </label>
            <label>
              Last name
              <input name="lastName" required autoComplete="family-name" placeholder="Lee" />
            </label>
          </div>
          <label>
            Pickup location
            <input name="pickup" required placeholder="Address, landmark, or intersection" />
          </label>
          <label>
            Preferred shelter
            <select name="shelterId" required defaultValue="">
              <option value="" disabled>Select a shelter</option>
              {shelters.map((shelter) => (
                <option key={shelter.id} value={shelter.id}>
                  {shelter.name} · {shelter.available_beds} reported beds
                </option>
              ))}
            </select>
          </label>
          <button className="button button-primary full-width" type="submit" disabled={submitting || !shelters.length}>
            {submitting ? "Sending request…" : "Request transportation"}
          </button>
          <small>Your pickup details stay private until a verified driver accepts.</small>
        </form>
      </section>

      {ride && (
        <section className="tracking-card" aria-label="Ride tracking details">
          <div>
            <p className="eyebrow">Request #{ride.id}</p>
            <h2>Your request is {ride.status.toLowerCase()}.</h2>
          </div>
          <div className="tracking-token">
            <span>Private tracking token — save this now</span>
            <code>{ride.tracking_token}</code>
          </div>
        </section>
      )}

      <section className="driver-section" id="driver-access">
        <div>
          <p className="eyebrow">Volunteer drivers</p>
          <h2>Bring a little more certainty to someone&apos;s night.</h2>
          <p>Driver accounts are identity-managed by Better Auth and verified by the shelter network.</p>
        </div>
        {session ? (
          <form className="driver-form" onSubmit={handleDriverSetup}>
            <p className="signed-in-copy">
              Signed in as <strong>{session.user.email}</strong>
              {userRole ? ` · ${userRole.replace("_", " ")}` : ""}
            </p>
            <label>
              Mobile number
              <input name="phone" required inputMode="tel" placeholder="205 555 0100" />
            </label>
            <button className="button button-dark" disabled={submitting} type="submit">
              Save driver profile
            </button>
          </form>
        ) : (
          <form className="driver-form" onSubmit={handleAccount}>
            <div className="auth-toggle" role="tablist" aria-label="Account action">
              <button
                type="button"
                className={authMode === "sign-up" ? "active" : ""}
                onClick={() => setAuthMode("sign-up")}
              >
                Create account
              </button>
              <button
                type="button"
                className={authMode === "sign-in" ? "active" : ""}
                onClick={() => setAuthMode("sign-in")}
              >
                Sign in
              </button>
            </div>
            {authMode === "sign-up" && (
              <label>
                Full name
                <input name="name" required autoComplete="name" placeholder="Alex Morgan" />
              </label>
            )}
            <label>
              Email address
              <input name="email" required type="email" autoComplete="email" placeholder="alex@example.org" />
            </label>
            <label>
              Password
              <input name="password" required minLength={8} type="password" autoComplete={authMode === "sign-up" ? "new-password" : "current-password"} />
            </label>
            <button className="button button-dark" disabled={submitting} type="submit">
              {submitting ? "One moment…" : authMode === "sign-up" ? "Join as a driver" : "Sign in"}
            </button>
          </form>
        )}
      </section>

      <footer>
        <span>ShelterConnect · built for the ShiptHacks demo</span>
        <span>Not a guarantee of shelter admission or emergency services.</span>
      </footer>
    </main>
  );
}
