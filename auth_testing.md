# Auth Testing Playbook

Step 1: MongoDB Verification
```
mongosh
use test_database
db.users.find({role: "admin"}).pretty()
```
Verify: bcrypt hash starts with `$2b$`, unique index on users.email.

Step 2: API Testing
```
curl -c cookies.txt -X POST $API/api/auth/login -H "Content-Type: application/json" -d '{"email":"demo@smena.app","password":"demo12345"}'
curl -b cookies.txt $API/api/auth/me
```
Login returns {user, access_token, refresh_token} and sets access_token + refresh_token cookies. Bearer header also accepted.
