export default function NewLead() {
  return (
    <section className="panel">
      <p className="eyebrow">Intake</p>
      <h1>New lead</h1>
      <p className="muted">
        Leads are maintained in Notion and synced to the Google Sheet. Add new rows there — the OPS
        dashboard refreshes within a few seconds.
      </p>
      <p className="ops-banner" style={{ marginTop: '1rem' }}>
        Sheet:{' '}
        <a
          href="https://docs.google.com/spreadsheets/d/1GTFZwxfy3A5QP7SGPu1B_Viofc518Q7teF_wwRGSjYg/edit#gid=867308076"
          target="_blank"
          rel="noreferrer"
        >
          CasinWorks — Project Tracker & Leads → Leads tab
        </a>
      </p>
    </section>
  );
}
