# AIJE Operational Responder Architecture

AIJE treats a citizen report as an operational incident, not as a direct command to a real-world agency.

## Dispatch chain

Citizen report → operational intake → Community Emergency Dashboard → verify → assign response team → dispatch → responder acknowledgement → response started → resolved.

## Lifecycle

- pending — report received
- verified — operator confirmed the incident for action
- dispatched — an authorized dispatcher sent the incident to an assigned team
- acknowledged — a member of that team accepted responsibility
- responding — the responder has started field action
- resolved — the response was completed

## Recommended pilot teams

| Team type | Purpose |
| --- | --- |
| Security | Community security/watch coordination and liaison |
| Medical | First aid, ambulance/health response coordination |
| Fire & Rescue | Fire, rescue and hazardous-scene support |
| Search & Rescue | Missing persons, trapped persons and recovery |
| Flood & Disaster | Flooding, storm and environmental emergencies |
| Humanitarian | Displacement, shelter, food and relief coordination |
| Community Volunteers | Local eyes, escorts, welfare checks and first response |

Teams are configurable operational units. Team membership is organization-scoped and must carry the incidents.respond permission.

## Dispatch authority

- reports.verify — verify a citizen report.
- incidents.assign — assign a response team and manage responder assignments.
- alerts.dispatch — authorize an actual dispatch.
- incidents.respond — acknowledge, start and complete an assigned response.

The database enforces these permissions. A responder cannot acknowledge or advance an incident unless they belong to the dispatched team.

## Notification channels

1. In-app — authoritative operational notification. AIJE creates notifications for active responders when a team is assigned/dispatched.
2. WhatsApp — optional fallback. If a responder has a configured WhatsApp target and the provider is configured, AIJE attempts WhatsApp delivery.
3. SMS — fallback of the fallback. If WhatsApp is unavailable or fails, AIJE attempts SMS when the responder has an enabled phone number and an SMS provider is configured.

Delivery is logged separately from human acknowledgement. A provider saying sent does not mean the responder accepted the dispatch.

## Responder acknowledgement

1. Acknowledge Dispatch
2. Start Response
3. Mark Resolved

Each action is recorded in incident_audit_log.

## Safety boundary

AIJE should not silently impersonate or automatically command police, military, fire services, hospitals, vigilantes or other external authorities.

The pilot should first establish the actual participating organizations, authorized operators, team membership, contact details and escalation agreements. AIJE then coordinates those configured responders.

## Pilot configuration checklist

- Create the pilot organization.
- Create the response teams.
- Add authorized members to each team.
- Grant the correct roles/permissions.
- Configure responder phone and WhatsApp details.
- Configure Termii or Twilio secrets.
- Test in-app notification delivery.
- Test WhatsApp delivery.
- Test SMS fallback.
- Test acknowledgement and escalation.
- Verify audit history and tenant isolation.
- Run a controlled tabletop exercise before a real incident.

This configuration turns the Community Emergency Dashboard into an operational coordination system while keeping final real-world dispatch authority with authorized humans.