import sqlite3
c = sqlite3.connect("/data/familiestem.db"); c.row_factory = sqlite3.Row
print("orders totaal:", c.execute("SELECT COUNT(*) FROM orders WHERE is_demo=0").fetchone()[0])
print("EVENTS laatste 24u:")
for r in c.execute("SELECT name,detail,COUNT(*) n FROM events WHERE created_at > datetime('now','-1 day') GROUP BY name,detail ORDER BY n DESC LIMIT 20"):
    print(dict(r))
