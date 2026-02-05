# Reminder UI Wireframes

These wireframes define the reminder screens for daily, weekly, monthly, quarterly, and career views. The goal is to make the next action obvious and build muscle memory.

**Layout Rules**

1. Primary action is always top-right.
2. Stage rail is always left.
3. Top row shows time horizon and status.

**Daily Focus**

```
┌──────────────────────────────────────────────────────────────────────┐
│ Daily Focus                                        [Start Top Task]  │
├───────────────┬────────────────────────────────────┬─────────────────┤
│ Plan/Exec/Rev │ Now                                │ Action Stack    │
│ Ship/Observe  │ - Fix failing tests                │ 1. Resume Task  │
│               │ - Review PR #124                   │ 2. Run Tests    │
│               │ - Reply to blocker                 │ 3. Open PR      │
│               │                                    │                 │
│               │ Next                               │ Context         │
│               │ - Draft release notes              │ Selected task   │
│               │ - Triage new issues                │ details here    │
│               │                                    │                 │
│               │ Waiting                            │                 │
│               │ - Awaiting review                  │                 │
└───────────────┴────────────────────────────────────┴─────────────────┘
```

**Weekly Review**

```
┌──────────────────────────────────────────────────────────────────────┐
│ Weekly Review                                     [Plan Next Week]   │
├───────────────┬────────────────────────────────────┬─────────────────┤
│ Plan/Exec/Rev │ Wins                               │ Action Stack    │
│ Ship/Observe  │ - Closed 12 issues                 │ 1. Set Goals    │
│               │ - Shipped feature X                │ 2. Groom Backlog│
│               │                                    │ 3. Update Stake │
│               │ Misses                             │                 │
│               │ - Milestone slipped                │ Risks           │
│               │ - Blocker unresolved               │ Top 3 risks     │
└───────────────┴────────────────────────────────────┴─────────────────┘
```

**Monthly Check‑in**

```
┌──────────────────────────────────────────────────────────────────────┐
│ Monthly Check‑in                                   [Re‑align Scope]  │
├───────────────┬────────────────────────────────────┬─────────────────┤
│ Plan/Exec/Rev │ Initiative Progress                │ Action Stack    │
│ Ship/Observe  │ - Initiative A: 70%                │ 1. Adjust Plan  │
│               │ - Initiative B: 40%                │ 2. Move Resources|
│               │                                    │ 3. Update Notes │
│               │ Drift Signals                      │                 │
│               │ - KPI down 2 cycles                │ Context         │
│               │ - Milestone missed                 │ Root causes     │
└───────────────┴────────────────────────────────────┴─────────────────┘
```

**Quarterly Reset**

```
┌──────────────────────────────────────────────────────────────────────┐
│ Quarterly Reset                                   [Commit Next Bets] │
├───────────────┬────────────────────────────────────┬─────────────────┤
│ Plan/Exec/Rev │ KPI Review                         │ Action Stack    │
│ Ship/Observe  │ - Reliability +2.1%                │ 1. Choose Bets  │
│               │ - Activation -0.4%                 │ 2. Set OKRs     │
│               │                                    │ 3. Share Plan   │
│               │ Initiative Scorecard               │                 │
│               │ - A: Green                         │ Risks           │
│               │ - B: Yellow                        │ Biggest gaps    │
└───────────────┴────────────────────────────────────┴─────────────────┘
```

**Career Growth**

```
┌──────────────────────────────────────────────────────────────────────┐
│ Career Growth                                      [Update Goals]    │
├───────────────┬────────────────────────────────────┬─────────────────┤
│ Plan/Exec/Rev │ Skills In Motion                   │ Action Stack    │
│ Ship/Observe  │ - System design                    │ 1. Pick Stretch │
│               │ - Incident response                │ 2. Request Ment |
│               │                                    │ 3. Log Progress |
│               │ Growth Signals                     │                 │
│               │ - No stretch work in 60 days       │ Context         │
│               │ - Limited cross‑team impact        │ Next milestone  │
└───────────────┴────────────────────────────────────┴─────────────────┘
```

**Keyboard Consistency**

| Key           | Action               |
| ------------- | -------------------- |
| `1`           | Plan                 |
| `2`           | Execute              |
| `3`           | Review               |
| `4`           | Ship                 |
| `5`           | Observe              |
| `Enter`       | Run primary action   |
| `Shift+Enter` | Run secondary action |

