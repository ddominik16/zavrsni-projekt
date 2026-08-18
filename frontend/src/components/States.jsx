export function Loading({ what = "Ucitavam" }) {
  return <div className="state">{what}…</div>;
}

export function ErrorBox({ message }) {
  return (
    <div className="state state--error">
      Greska: {message}
      <br />
      Provjeri je li backend pokrenut i je li baza otvorena u Neo4j Desktopu.
    </div>
  );
}

export function Empty({ message = "Nema rezultata." }) {
  return <div className="state">{message}</div>;
}
