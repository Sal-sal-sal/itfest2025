from backend.app.core import security


def test_password_hash_and_verify() -> None:
    password = "StrongPassw0rd!"
    hashed = security.hash_password(password)

    assert hashed != password
    assert security.verify_password(password, hashed)


def test_access_and_refresh_tokens_have_different_types() -> None:
    subject = "123"
    access = security.create_access_token(subject)
    refresh = security.create_refresh_token(subject)

    access_payload = security.decode_token(access)
    refresh_payload = security.decode_token(refresh)

    assert access_payload["type"] == "access"
    assert refresh_payload["type"] == "refresh"
    assert access_payload["sub"] == refresh_payload["sub"] == subject




