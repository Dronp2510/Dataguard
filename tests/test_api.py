import asyncio
import io
import shutil
import unittest
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.datastructures import UploadFile
from starlette.requests import Request

from app.api import auth as auth_api
from app.api import share as share_api
from app.api import vault as vault_api
from app.core import rate_limit
from app.database import Base
from app.services import auth as auth_service
from app.utils import STORAGE_PATH as DEFAULT_STORAGE_PATH


class ApiRouteUnitTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp_dir = Path("tests_runtime") / f"dataguard-tests-{uuid4().hex}"
        cls.tmp_dir.mkdir(parents=True, exist_ok=True)
        cls.db_path = cls.tmp_dir / "test.db"
        cls.storage_path = cls.tmp_dir / "storage"
        cls.storage_path.mkdir(parents=True, exist_ok=True)

        cls.engine = create_engine(
            f"sqlite:///{cls.db_path}",
            connect_args={"check_same_thread": False},
        )
        cls.TestSessionLocal = sessionmaker(bind=cls.engine)
        Base.metadata.create_all(bind=cls.engine)

        auth_api.SessionLocal = cls.TestSessionLocal
        auth_service.SessionLocal = cls.TestSessionLocal
        vault_api.SessionLocal = cls.TestSessionLocal
        share_api.SessionLocal = cls.TestSessionLocal
        vault_api.STORAGE_PATH = cls.storage_path

    @classmethod
    def tearDownClass(cls):
        auth_api.SessionLocal = auth_service.SessionLocal
        vault_api.STORAGE_PATH = DEFAULT_STORAGE_PATH
        cls.engine.dispose()
        shutil.rmtree(cls.tmp_dir, ignore_errors=True)

    def setUp(self):
        rate_limit.RATE_BUCKETS.clear()

    def signup_and_login(self, username, email, password):
        signup = auth_api.signup(
            request=self.fake_request(),
            username=username,
            email=email,
            password=password,
        )
        self.assertEqual(signup["message"], "User created successfully")
        login = auth_api.login(request=self.fake_request(), email=email, password=password)
        self.assertIn("access_token", login)
        return login

    def current_user(self, token):
        return auth_service.get_current_user(token=token)

    def fake_request(self):
        scope = {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": [(b"user-agent", b"unittest")],
            "client": ("127.0.0.1", 12345),
            "scheme": "http",
            "server": ("testserver", 80),
            "query_string": b"",
        }
        return Request(scope)

    def test_auth_session_creation_and_resolution(self):
        login = self.signup_and_login("alice", "alice@test.com", "secret123")
        token = login["access_token"]
        user = self.current_user(token)
        self.assertEqual(user.email, "alice@test.com")

    def test_folder_rename_delete_flow(self):
        login = self.signup_and_login("bob", "bob@test.com", "secret123")
        user = self.current_user(login["access_token"])

        created = vault_api.create_folder(name="docs", parent_id=None, current_user=user)
        folder_id = created["id"]

        listed = vault_api.list_vault_items(parent_id=None, current_user=user)
        self.assertEqual(len(listed), 1)
        self.assertEqual(listed[0]["name"], "docs")

        renamed = vault_api.rename_item(item_id=folder_id, new_name="documents", current_user=user)
        self.assertEqual(renamed["message"], "Renamed successfully")

        listed_after = vault_api.list_vault_items(parent_id=None, current_user=user)
        self.assertEqual(listed_after[0]["name"], "documents")

        deleted = vault_api.delete_item(item_id=folder_id, current_user=user)
        self.assertEqual(deleted["message"], "Deleted successfully")

        final_list = vault_api.list_vault_items(parent_id=None, current_user=user)
        self.assertEqual(final_list, [])

    def test_file_upload_download_and_owner_check(self):
        alice_login = self.signup_and_login("carl", "carl@test.com", "secret123")
        bob_login = self.signup_and_login("dina", "dina@test.com", "secret123")
        alice_user = self.current_user(alice_login["access_token"])
        bob_user = self.current_user(bob_login["access_token"])

        upload_file = UploadFile(filename="secret.bin", file=io.BytesIO(b"ciphertext"))
        created = asyncio.run(
            vault_api.upload_encrypted_file(
                request=self.fake_request(),
                encrypted_file=upload_file,
                filename="secret.bin",
                mime_type="application/octet-stream",
                parent_folder_id=None,
                encrypted_key="abc",
                iv="def",
                key_iv="ghi",
                current_user=alice_user,
            )
        )
        file_id = created["file_id"]

        meta = vault_api.download_encrypted_file(file_id=file_id, current_user=alice_user)
        self.assertEqual(meta["metadata"]["filename"], "secret.bin")

        with self.assertRaises(HTTPException) as ctx:
            vault_api.download_encrypted_file(file_id=file_id, current_user=bob_user)
        self.assertEqual(ctx.exception.status_code, 403)

        blob = vault_api.download_encrypted_blob(file_id=file_id, current_user=alice_user)
        self.assertEqual(blob.filename, "secret.bin")

    def test_share_link_with_view_limit_and_revoke(self):
        owner_login = self.signup_and_login("eric", "eric@test.com", "secret123")
        owner = self.current_user(owner_login["access_token"])

        upload_file = UploadFile(filename="share.bin", file=io.BytesIO(b"sharecipher"))
        created = asyncio.run(
            vault_api.upload_encrypted_file(
                request=self.fake_request(),
                encrypted_file=upload_file,
                filename="share.bin",
                mime_type="application/octet-stream",
                parent_folder_id=None,
                encrypted_key="owner-wrapped-key",
                iv="file-iv",
                key_iv="owner-key-iv",
                current_user=owner,
            )
        )
        file_id = created["file_id"]

        share = share_api.create_share_link(
            request=self.fake_request(),
            file_id=file_id,
            encrypted_key="share-wrapped-key",
            key_iv="share-key-iv",
            key_salt="share-salt",
            expiry_option="10",
            max_views=1,
            current_user=owner,
        )
        self.assertIn("share_url", share)
        token = share["share_url"].split("/")[-1]

        metadata = share_api.share_metadata(
            token=token,
            request=self.fake_request(),
            authorization=None,
            x_guest_id="guest-test",
        )
        self.assertEqual(metadata["metadata"]["encrypted_key"], "share-wrapped-key")

        blob = share_api.share_blob(
            token=token,
            request=self.fake_request(),
            action="preview",
            authorization=None,
            x_guest_id="guest-test",
        )
        self.assertEqual(blob.filename, "share.bin")

        with self.assertRaises(HTTPException) as view_limited:
            share_api.share_blob(
                token=token,
                request=self.fake_request(),
                action="preview",
                authorization=None,
                x_guest_id="guest-test",
            )
        self.assertEqual(view_limited.exception.status_code, 410)

        share2 = share_api.create_share_link(
            request=self.fake_request(),
            file_id=file_id,
            encrypted_key="share-wrapped-key-2",
            key_iv="share-key-iv-2",
            key_salt="share-salt-2",
            expiry_option="forever",
            max_views=None,
            current_user=owner,
        )
        share_id = share2["share_id"]
        revoke = share_api.revoke_share(share_id=share_id, current_user=owner)
        self.assertEqual(revoke["message"], "Share revoked")

        logs = share_api.share_logs(share_id=share["share_id"], current_user=owner)
        self.assertGreaterEqual(len(logs), 2)


if __name__ == "__main__":
    unittest.main()
