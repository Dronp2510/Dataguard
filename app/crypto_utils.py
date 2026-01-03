from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.backends import default_backend
import os

def generate_aes_key_iv():
    key = os.urandom(32) #AES-256
    iv = os.urandom(16)
    return key , iv

def encrypt_file(data, key, iv):
    cipher = Cipher(algorithms.AES(key), modes.CFB(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    return encryptor.update(data) + encryptor.finalize()


def encrypt_bytes(data: bytes, key: bytes, iv: bytes) -> bytes:
    cipher = Cipher(algorithms.AES(key), modes.CFB(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    return encryptor.update(data) + encryptor.finalize()

def decrypt_bytes(data: bytes, key: bytes, iv: bytes) -> bytes:
    cipher = Cipher(algorithms.AES(key), modes.CFB(iv), backend=default_backend())
    decryptor = cipher.decryptor()
    return decryptor.update(data) + decryptor.finalize()

# def generate_rsa_keys():
#     private_key = rsa.generate_private_key(
#         public_exponent=65537,
#         key_size=2048
#     )
#     return private_key, private_key.public_key()
#
# def encrypt_aes_key(aes_key, public_key):
#     return public_key.encrypt(
#         aes_key,
#         padding.OAEP(
#             mgf=padding.MGF1(hashes.SHA256()),
#             algorithm=hashes.SHA256(),
#             label=None
#         )
#     )
#
# def decrypt_aes_key(encrypted_key, private_key):
#     return private_key.decrypt(
#         encrypted_key,
#         padding.OAEP(
#             mgf=padding.MGF1(hashes.SHA256()),
#             algorithm=hashes.SHA256(),
#             label=None
#         )
#     )
#
# def decrypt_file(ciphertext, key, iv):
#     cipher = Cipher(algorithms.AES(key), modes.CFB(iv), backend=default_backend())
#     decryptor = cipher.decryptor()
#     return decryptor.update(ciphertext) + decryptor.finalize()
