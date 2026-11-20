"""Summarise measured series performance and choose next week's rotation."""
import datetime as dt
import json
from collections import defaultdict

def summary(connection, start, end):
    totals = defaultdict(lambda: {'posts':0, 'measured':0, 'interactions':0, 'reach':0})
    for series, raw in connection.execute("SELECT series, metrics FROM jobs WHERE state='published' AND day>=? AND day<?",(str(start),str(end))):
        row = totals[series]
        row['posts'] += 1
        metrics = json.loads(raw)
        if all(isinstance(metrics.get(k), int) for k in ('reach','saved','shares')) and metrics['reach'] > 0:
            row['measured'] += 1
            row['reach'] += metrics['reach']
            row['interactions'] += metrics['saved'] + metrics['shares']
    for row in totals.values():
        row['rate'] = row['interactions'] / row['reach'] if row['reach'] else None
    return dict(totals)

def select(connection, date, catalog, recent):
    monday = date - dt.timedelta(days=date.weekday())
    stats = summary(connection,monday-dt.timedelta(days=56),monday)
    eligible = [s for s in catalog if stats.get(s,{}).get('measured',0)>=5]
    # One exploratory slot per week. Never repeat a series within three days.
    if date.weekday()==5 and len(eligible)>=3:
        candidates = [s for s in eligible if s not in recent[:3]]
        if candidates:
            return max(candidates,key=lambda s:stats[s]['rate'])
    return max(catalog,key=lambda s:recent.index(s) if s in recent else len(recent))
