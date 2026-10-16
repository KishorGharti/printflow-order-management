<USER_REQUEST>
# Print Ghar — Final Authentication & Role-Based Dashboard System

Implement the final login and employee system for my Print Ghar order management SaaS.

The existing PostgreSQL, JWT authentication, multi-tenant business isolation, RBAC, and security fixes are already working. **Do not break or rewrite the existing security architecture.**

## 1. Login Behavior

Use one proper authentication system, but route each authenticated user to the correct dashboard based on their account type/access.

After successful login:

```text
Owner → Owner Dashboard
Reception → Reception Dashboard
Designer → Designer Dashboard
Printer/Finisher → Printer/Finisher Dashboard
```

Do NOT allow users to manually switch roles to gain access.

The backend must determine the user's actual account/access from the database.

---

## 2. Separate Login Portals

Create separate login entry points:

```text
/admin/login
```

For Developer/Super Admin only.

```text
/owner/login
```

For Owner and Reception.

```text
/employee/login
```

For Designer and Printer/Finisher employees.

The login page must NOT blindly trust the URL. The backend must verify that the account is actually allowed to use that portal.

Example:

```text
Designer tries /owner/login
→ Reject

Owner tries /employee/login
→ Reject
```

After login, redirect to the correct dashboard based on the authenticated account.

---

## 3. Owner

Owner has full access to the business.

Owner dashboard should include existing features such as:

```text
Dashboard
Orders
Customers
Products
Stock
Payments
Expenses
Reports
Ledger
Team Members
Settings
```

Owner can also:

* Create employees
* Edit employees
* Disable/enable employees
* Assign Designer access
* Assign Printer/Finisher access
* Reset employee passwords

---

## 4. Reception

Reception has the same full application access as Owner.

Reception can use:

```text
Orders
Customers
Products
Stock
Payments
Pickup
Delivery
Expenses
Reports
Ledger
```

Reception does not need manually assigned permissions.

---

## 5. Designer

Designer gets a separate employee dashboard.

Designer should see only the features needed for design/workflow, such as:

```text
Dashboard
Orders / Assigned Orders
Design Work
Production Status
Profile
Change Password
```

Designer must NOT see financial information:

* Order total
* Product price
* Paid amount
* Balance
* Payment method
* Advance
* Expenses
* Ledger
* Financial reports

Do not only hide these in the frontend. Backend APIs should also avoid returning sensitive financial fields to Designer where practical.

---

## 6. Printer/Finisher

Printer/Finisher gets a separate employee dashboard.

They should see:

```text
Dashboard
Orders / Assigned Orders
Printing
Finishing
Production Status
Profile
Change Password
```

They must NOT see:

* Order total
* Product price
* Paid amount
* Balance
* Payment information
* Expenses
* Ledger
* Financial reports

Again, enforce this in the backend, not only the frontend.

---

## 7. Employee With Multiple Access

An employee can have both:

```text
Designer
+
Printer/Finisher
```

Example:

```text
Ram
✓ Designer
✓ Printer/Finisher
```

After Ram logs in, his dashboard should contain both areas:

```text
Dashboard
Design
Printing
Finishing
Orders
Profile
```

Do NOT create two separate accounts for him.

He has:

```text
one employee account
one password
one JWT/session
multiple access permissions
```

---

## 8. Individual Employee Login

Every employee must have their own account.

Example:

```text
Ram   → own account/JWT
Sita  → own account/JWT
Hari  → own account/JWT
```

They must be able to log in from different:

* Computers
* Browsers
* Locations

at the same time.

One employee logging in must NEVER overwrite another employee's token/session.

Do not use a shared employee JWT.

---

## 9. Employee Password

Employees should have:

```text
Profile
→ Change Password
```

with:

```text
Current Password
New Password
Confirm Password
```

Also provide:

```text
Forgot Password
```

if the existing email/verification system supports it.

Owner can reset an employee password, but must never be able to view the employee's existing password.

Passwords must remain hashed with the existing secure password hashing system.

---

## 10. No Role Switching

Remove/disable the old behavior where a dropdown such as:

```text
Owner
Reception
Designer
Printer/Finisher
```

can trigger another login.

Changing UI state must NEVER:

```text
POST /api/auth/login
```

or overwrite the current JWT.

The user's actual account determines their access.

---

## 11. Multi-Tenant Security

Preserve all existing tenant isolation.

Every authenticated user belongs to a specific:

```text
businessId
```

An employee can only access data belonging to their own business.

Do not trust client-provided:

```text
X-Business-Id
X-Role
```

over the authenticated server-side identity.

Keep existing tenant-scoped queries and identifier resolution.

For example:

```sql
WHERE
(local_id = $1 OR order_number = $1)
AND business_id = $2
```

Do not regress the existing cross-business protection.

---

## 12. Final Flow

The final system should behave like:

```text
                    LOGIN
                      │
                      ▼
              Authenticate User
                      │
                      ▼
              Identify Account
                      │
       ┌──────────────┼──────────────┐
       ↓              ↓              ↓
     Owner        Reception       Employee
       │              │              │
       ↓              ↓        Check Access
 Owner Dashboard   Full Access        │
                               ┌──────┴──────┐
                               ↓             ↓
                           Designer    Printer/Finisher
```

If employee has both:

```text
Designer + Printer/Finisher
```

show both areas.

---

## 13. Important

Do not rewrite the entire application.

First inspect the existing:

* Authentication
* JWT
* `team_members`
* RBAC middleware
* Login pages
* Dashboard routing
* Role switcher
* Employee APIs
* Multi-tenant middleware

Then make the smallest clean changes required.

Preserve all existing working features and tests, especially the existing multi-tenant isolation and authorization tests.

</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-10-01T10:10:02+05:45.

The user's current state is as follows:
Active Document: c:\Users\u\Desktop\Print Ghar order mgmt\dist\app.js (LANGUAGE_JAVASCRIPT)
Cursor is on line: 1
Other open documents:
- c:\Users\u\Desktop\Print Ghar order mgmt\src\pages\SettingsPage.tsx (LANGUAGE_TSX)
- c:\Users\u\Desktop\Print Ghar order mgmt\backend\src\routes\team.js (LANGUAGE_JAVASCRIPT)
- c:\Users\u\Desktop\Print Ghar order mgmt\backend\src\models\StockTransaction.js (LANGUAGE_JAVASCRIPT)
- c:\Users\u\Desktop\Print Ghar order mgmt\backend\src\controllers\whatsappController.js (LANGUAGE_JAVASCRIPT)
- c:\Users\u\Desktop\Print Ghar order mgmt\backend\src\models\MonthlyReport.js (LANGUAGE_JAVASCRIPT)
Running terminal commands:
- npm run dev:all
 (in c:\Users\u\Desktop\Print Ghar order mgmt, running for 23h46m38s)
</ADDITIONAL_METADATA>
<USER_SETTINGS_CHANGE>
The user changed setting `Model Selection` from Gemini 3.8 Flash (High) to Claude Sonnet 4.6 (Thinking). No need to comment on this change if the user doesn't ask about it. If reporting what model you are, please use a human readable name instead of the exact string.
</USER_SETTINGS_CHANGE>