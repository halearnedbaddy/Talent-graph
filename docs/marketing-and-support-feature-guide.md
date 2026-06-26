# Talent Graph Kenya — Marketing & Client Support Feature Guide

**Prepared for:** Marketing & Client Support Team  
**Platform:** Talent Graph Kenya (Admin Dashboard)  
**Date:** June 26, 2026  

---

## HOW TO ACCESS THE ADMIN DASHBOARD

1. Sign in with your admin account at the Talent Graph Kenya URL.
2. Navigate to `/jobs/admin/dashboard` in your browser.
3. You will land on the **Platform Command** workspace selector — a screen with three cards:

| Workspace | What it's for |
|---|---|
| **Command Center** | Verifications, reports, platform analytics, waiting list |
| **Client Support** | Ticket inbox, reply threads, internal notes, SLA tracking |
| **Marketing** | Campaigns, audience segments, automations, analytics |

Click the card for the workspace you need. You can return to this selector at any time using the back arrow in the top-left corner.

---

# PART 1 — MARKETING WORKSPACE

## Overview

The Marketing workspace is your full command centre for reaching Talent Graph's users. It covers four tabs: **Campaigns**, **Segments**, **Automations**, and **Analytics**. You also have a top-level stats bar that summarises performance across everything at a glance.

---

## Top Stats Bar

At the top of the Marketing workspace, six numbers update in real time:

| Stat | What it means |
|---|---|
| **Total Reach** | Sum of all recipients across every campaign ever sent |
| **Campaigns** | Total number of campaigns created (all statuses) |
| **Avg Open Rate** | Average open rate across all sent campaigns. Green ≥ 25 %, Amber ≥ 10 %, Red < 10 % |
| **Converted** | Total conversions tracked across all campaigns |
| **Active/Scheduled** | Campaigns currently sending or scheduled to go out |
| **Automations** | Count of active automated sequences |

---

## Tab 1 — Campaigns

This is where you create, schedule, send, and manage individual marketing messages.

### What you can do
- See all campaigns in a list with their status, channel, and performance numbers.
- Create a new campaign using the **+ Campaign** button (top right).
- Preview exactly what recipients will see before sending.
- Clone an existing campaign to reuse a template.
- Send immediately or schedule for a future date/time.
- Delete campaigns no longer needed.

### Campaign statuses

| Status | Meaning |
|---|---|
| **Draft** | Saved but not yet sent or scheduled |
| **Scheduled** | Set to send automatically at a future date/time |
| **Sending** | Currently being dispatched to recipients |
| **Sent** | Fully delivered — analytics are now populated |

### Delivery channels

| Channel | What goes out |
|---|---|
| **Email** | Email only |
| **SMS** | SMS only (to users who have a phone number on file) |
| **Email + SMS** | Both channels simultaneously |

### Creating a campaign (2-step wizard)

**Step 1 — Setup**
1. Enter a **Campaign Name** (e.g. "Welcome Athletes — July 2026").
2. Choose the **Channel** (Email, SMS, or both).
3. Select an **Audience Segment** from your saved segments (see Segments tab).
4. Optionally, set a **Scheduled Date/Time** — leave blank to save as a draft.
5. Click **Next**.

**Step 2 — Content**
1. For **Email**: write a **Subject line** and **Email Body**. The body supports merge fields `{{first_name}}` and `{{role}}` which auto-fill per recipient.
2. For **SMS**: write the **SMS Body** (160 character limit shown live).
3. Toggle **A/B Test** on if you want to test two subject lines or email bodies against each other — you'll fill in Variant A and Variant B separately.
4. Click **Save Campaign**.

### Sending a campaign
1. On any Draft or Scheduled campaign card, click the **Send** button.
2. A confirmation pop-up shows the campaign name, channel, target segment, estimated recipient count, and (for SMS campaigns) the count of users with a phone number.
3. Click **Send Now** to dispatch immediately. Unsubscribed contacts are skipped automatically.

### A/B Testing
- When A/B test is enabled, the system splits the audience and sends Variant A to half and Variant B to the other half.
- The preview modal lets you toggle between "Variant A" and "Variant B" to check each version.
- A **🏆 winning** badge appears on whichever variant is performing better.

### Previewing a campaign template
- Click the **Eye (Preview)** icon on any campaign card to open a full render of the email or SMS body exactly as recipients will see it, including the Talent Graph header and footer.

### Run Scheduler
- The amber **Run Scheduler** button (top right) manually triggers the cron job that checks for scheduled campaigns that are due and sends them.
- Use this if a scheduled campaign did not send automatically. The result banner tells you how many campaigns were processed.

---

## Tab 2 — Segments

Segments are saved audience lists that campaigns and automations are sent to. You must create at least one segment before you can send a campaign.

### What you can do
- See all saved segments with their member count and filter criteria.
- Create a new segment using the **+ Segment** button.
- Refresh a segment's member count using the **⟳** icon.
- Delete a segment using the **🗑** icon.

### Creating a segment

1. Click **+ Segment**.
2. Enter a **Segment Name** (e.g. "Active Athletes — Nairobi").
3. Set the filter criteria (all fields are optional — leaving them blank targets all users):

| Filter | What it does |
|---|---|
| **Role** | Athlete, Scout, Coach, Club, or Analyst only |
| **Active within (days)** | Only users who have logged in within the last N days |
| **Country** | e.g. Kenya |
| **County** | e.g. Nairobi, Kisumu |

4. Click **Create Segment**.
5. After creation, click **⟳ Refresh** on the segment card to calculate the live member count and SMS-eligible count.

### SMS-eligible count
Each segment card shows two numbers: total members and **SMS eligible** (members who have a phone number on file). This is shown in the Send Confirmation modal so you know the true SMS reach before sending.

---

## Tab 3 — Automations

Automations are triggered messages sent automatically when a user meets a certain condition — no manual action needed once they are active.

### What you can do
- See all automations with their trigger rule, channel, triggered count, and conversion count.
- Create a new automation using the **+ Automation** button.
- **Pause** or **Activate** any automation with one click.
- Delete automations no longer needed.

### Available triggers

| Trigger | When it fires |
|---|---|
| **Days since signup** | N days after a user creates their account |
| **Days since provisioned** | N days after an account is provisioned by an admin |
| **Profile incomplete** | Fires if the user's profile is not fully filled in |
| **No login for N days** | Re-engagement — fires when a user has been inactive |
| **Scout viewed profile** | Fires when a scout views an athlete's profile |

### Creating an automation

1. Click **+ Automation**.
2. Enter an **Automation Name** (e.g. "Day 3 Profile Nudge").
3. Choose a **Trigger** from the list above.
4. Set the **Trigger Value** (number of days, if applicable).
5. Choose the **Channel** (Email or SMS).
6. Write the message content.
7. Save — the automation starts in **Paused** state. Click **Activate** when you are ready to go live.

### Reading automation stats
Each automation card shows:
- **Triggered**: how many times the automation has fired
- **Converted**: how many of those users took the target action
- **Conversion rate bar**: visual funnel from triggered to converted

---

## Tab 4 — Analytics

A read-only view summarising performance across all campaigns.

### Overall Send Funnel
A bar chart showing the cumulative pipeline across all sent campaigns:

| Stage | What it counts |
|---|---|
| Sent | Total messages dispatched |
| Delivered | Messages that reached the inbox / phone |
| Opened | Recipients who opened the email |
| Clicked | Recipients who clicked a link |
| Converted | Recipients who completed the target action |

Each stage shows the raw number and a percentage of total sent.

### Channel Breakdown
A bar chart splitting total sends by channel (Email, SMS, Email + SMS). Shows how many campaigns used each channel.

### Top Performing Campaigns Table
A ranked table of sent campaigns ordered by open rate, showing:
- Campaign name and rank
- Target segment
- Total sent
- Open rate (colour-coded green/amber/red)
- Click rate
- Converted count

---

# PART 2 — CLIENT SUPPORT WORKSPACE

## Overview

The Client Support workspace is your help-desk interface. All user-submitted tickets land here. It has a live stats bar, a filterable ticket list on the left, and a full conversation panel on the right.

---

## Top Stats Bar

Five cards show the current health of your support queue:

| Stat | What it means |
|---|---|
| **Open Tickets** | Tickets currently in "Open" status needing attention |
| **High Priority** | Open/pending tickets marked High priority |
| **Total Tickets** | All tickets ever created (all statuses) |
| **Resolved Today** | Tickets moved to "Resolved" status today |
| **Avg CSAT** | Average customer satisfaction rating (1–5 stars) across all rated tickets. Green ≥ 4, Amber ≥ 3, Red < 3 |

---

## Ticket List (Left Panel)

The left panel shows all tickets, filtered and sorted by most recently updated.

### Filters and search
- **Search bar**: Filter tickets by subject, user name, or email address.
- **Status filter**: Open, Pending User, Pending Internal, Resolved, Closed, or All.
- **Priority filter**: High, Medium, Low, or All.

### What each ticket row shows
- Subject line
- Sender name and email
- Priority badge (High / Medium / Low)
- Status badge
- CSAT star rating (if the user has rated the ticket)
- **SLA timer**: live countdown showing time remaining before the SLA deadline is breached, or "SLA Breached" in red if it has already passed.

### SLA deadlines by priority

| Priority | Response deadline |
|---|---|
| High | 1 hour from ticket creation |
| Medium | 4 hours from ticket creation |
| Low | 24 hours from ticket creation |

---

## Ticket Detail (Right Panel)

Click any ticket in the list to open the conversation.

### Ticket Header
Shows:
- Subject, sender name, email, and phone number (if provided).
- Status badge with a dropdown to change status.
- Priority badge with a dropdown to change priority.
- SLA timer.
- Tag dropdown to add/remove category tags (Billing, Verification, Technical, Onboarding, Other).

### Thread / Notes Toggle
Two tabs sit above the conversation:

**Thread** — The full conversation between the user and the support agent, in chronological order. User messages appear on the left; agent replies appear on the right.

**Internal Notes** — Private agent-only notes that the user never sees. Use this for escalation context, internal handoffs, or anything you don't want visible to the user.

### Replying to a ticket
1. Type your reply in the text box at the bottom of the Thread panel.
2. Click **Send** (or press Enter).
3. The ticket status automatically changes to **Pending User** after you reply.
4. If the user provided a phone number, they will automatically receive an **SMS notification** saying a support agent has replied to their ticket.

### Adding an internal note
1. Switch to the **Internal Notes** tab.
2. Type your note and click **Save Note**.
3. Notes are timestamped and show which agent wrote them.

### Changing ticket status

| Status | When to use |
|---|---|
| **Open** | New ticket, not yet responded to |
| **Pending User** | You have replied — waiting for the user to respond |
| **Pending Internal** | Escalated internally — waiting for another team member |
| **Resolved** | Issue is fixed — ticket is complete |
| **Closed** | Archived — no further action needed |

### Changing ticket priority
Use the priority dropdown in the ticket header. The SLA timer recalculates automatically if you change priority.

### Adding tags
Click the **Tag** button in the ticket header. Toggle any combination of: Billing, Verification, Technical, Onboarding, Other. Tags help you filter and report on ticket types.

---

## Creating a Ticket Manually

If a user contacts you outside the app (phone call, email, walk-in), you can create a ticket on their behalf:

1. Click the **+** button at the top of the ticket list.
2. Fill in:
   - **Email** (required)
   - **Name** (optional)
   - **Phone** (optional — enables SMS reply notifications)
   - **Subject** (required)
   - **Priority** (Low / Medium / High)
   - **Initial Message** (required — describe the issue)
3. Click **Create Ticket**.

The ticket is immediately visible in the list with the SLA clock running.

---

## How Users Submit Tickets (User Side)

Every user dashboard (Athlete, Scout, Coach, Club) has a **floating headphone button** in the bottom corner. When a user clicks it, a support dialog opens with three options:

1. **New Ticket** — the user fills in subject, message, a category tag, and priority, then submits. The ticket lands instantly in your admin queue.
2. **My Tickets** — the user can see all their past and open tickets and click any to read the conversation thread.
3. **Ticket Chat** — opens the full message thread for a selected ticket, where the user can send follow-up messages.

When you reply to a ticket in the admin dashboard, the user sees the reply next time they open their ticket chat — and receives an SMS if they have a phone number on file.

---

## CSAT (Customer Satisfaction Score)

After a ticket is resolved, users can leave a star rating (1–5). The rating appears on the ticket card in the list and feeds into the **Avg CSAT** stat at the top of the dashboard. There is no action required from the support team to trigger the rating — it is collected automatically.

---

# QUICK REFERENCE — COMMON TASKS

| Task | Where to go |
|---|---|
| Send a campaign now | Marketing → Campaigns → Click Send on a Draft |
| Schedule a campaign for later | Marketing → Create Campaign → set Scheduled Date |
| Find out how many athletes are in Nairobi | Marketing → Segments → Create Segment with County = Nairobi |
| Set up a welcome email for new signups | Marketing → Automations → Trigger: Days since signup, Value: 1 |
| Reply to a user's support ticket | Support → Click ticket → Thread tab → type reply → Send |
| Leave a private note for a colleague | Support → Click ticket → Internal Notes tab → type note |
| Create a ticket for a user who called in | Support → + button (top of ticket list) |
| Check which tickets are breaching SLA | Support → Filter by Status: Open → look for red "SLA Breached" labels |
| See overall campaign performance | Marketing → Analytics tab |
| Check average customer satisfaction | Support → Avg CSAT card (top stats bar) |

---

*All features described in this document are live and functional in the current build.*
