import sqlite3
c = sqlite3.connect("/data/familiestem.db"); c.row_factory = sqlite3.Row
print("ORDERS (niet-demo):")
for r in c.execute("SELECT id,created_at,status,amount_cents,print_copies,print_address IS NOT NULL AS adres,"
                   "confirmation_sent_at IS NOT NULL AS mail,print_status FROM orders WHERE is_demo=0 ORDER BY id DESC LIMIT 10"):
    print(dict(r))
print("STORIES per order:")
for r in c.execute("SELECT order_id,COUNT(*) n,SUM(status='approved') approved FROM stories s JOIN orders o ON o.id=s.order_id "
                   "WHERE o.is_demo=0 AND s.audio_path IS NOT NULL GROUP BY order_id"):
    print(dict(r))
print("EVENTS laatste 24u:")
for r in c.execute("SELECT name,COUNT(*) n FROM events WHERE created_at > datetime('now','-1 day') GROUP BY name ORDER BY n DESC"):
    print(dict(r))
