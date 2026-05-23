import requests

# Test login
login_response = requests.post(
    'http://localhost:8000/api/v1/auth/login',
    json={'email': 'MAHABHARATA@gmail.com', 'password': 'surrender'}
)

print(f"Login status: {login_response.status_code}")
print(f"Cookies: {login_response.cookies}")

# Test protected endpoint with cookies
me_response = requests.get(
    'http://localhost:8000/api/v1/auth/me',
    cookies=login_response.cookies
)

print(f"Me endpoint status: {me_response.status_code}")
print(f"Response: {me_response.json()}")