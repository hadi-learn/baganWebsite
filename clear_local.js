async function run() {
  const res = await fetch('http://localhost:3000/api/admin/gallery/summary');
  const data = await res.json();
  if (!data.summary) {
    console.log("No summaries found");
    return;
  }
  for (const s of data.summary) {
    await fetch('http://localhost:3000/api/admin/gallery/all', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchCode: s.matchCode })
    });
    console.log('Cleared', s.matchCode);
  }
  console.log("All clear");
}
run();
