import base64
import hashlib
import os

def generate_solr_password_hash(password):
    # Generate a random 16-byte salt
    salt = os.urandom(16)
    
    # Create a SHA-256 hash object and update it with the salt and password
    hash_obj = hashlib.sha256()
    hash_obj.update(salt)
    hash_obj.update(password.encode('utf-8'))
    
    # Get the hash digest
    password_hash = hash_obj.digest()
    
    # Encode both the salt and the hash in Base64
    salt_encoded = base64.b64encode(salt).decode('utf-8')
    password_hash_encoded = base64.b64encode(password_hash).decode('utf-8')
    
    # Combine them into the final format
    final_hash = f'{salt_encoded} {password_hash_encoded}'
    return final_hash

# Example usage
password = 'cursor-sleeve-tenuous-butler'  # Replace with the actual password you want to hash
hashed_password = generate_solr_password_hash(password)
print("Generated password hash for Solr:", hashed_password)
