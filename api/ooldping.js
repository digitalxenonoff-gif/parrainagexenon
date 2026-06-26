export default async function handler(req, res) {
  try {
    const response = await fetch(
      'https://yoobuoseddhdhexuaebs.supabase.co/rest/v1/parrainages?select=id&limit=1',
      {
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlvb2J1b3NlZGRoZGhleHVhZWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMzk0ODAsImV4cCI6MjA5MjYxNTQ4MH0.AFENqK13BlBFQ2MCTVk1aIWfCC-921DHnV00HHGbF0c',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlvb2J1b3NlZGRoZGhleHVhZWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMzk0ODAsImV4cCI6MjA5MjYxNTQ4MH0.AFENqK13BlBFQ2MCTVk1aIWfCC-921DHnV00HHGbF0c'
        }
      }
    );
    const data = await response.json();
    res.status(200).json({ ok: true, pinged: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
