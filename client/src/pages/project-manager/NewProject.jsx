export default function NewProject() {
  return (
    <section className="panel">
      <p className="eyebrow">Intake</p>
      <h1>New project</h1>
      <p className="muted">
        Projects are maintained in Notion and synced to the Google Sheet. Add new rows there — the OPS
        dashboard refreshes within a few seconds.
      </p>
      <p className="ops-banner" style={{ marginTop: '1rem' }}>
        Sheet:{' '}
        <a
          href="https://docs.google.com/spreadsheets/d/1GTFZwxfy3A5QP7SGPu1B_Viofc518Q7teF_wwRGSjYg/edit#gid=683572809"
          target="_blank"
          rel="noreferrer"
        >
          CasinWorks — Project Tracker & Leads
        </a>
      </p>
    </section>
  );
}
