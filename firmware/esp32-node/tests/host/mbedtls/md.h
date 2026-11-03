#pragma once
#include <openssl/hmac.h>
#define MBEDTLS_MD_SHA256 6
inline const void *mbedtls_md_info_from_type(int) { return nullptr; }
inline int mbedtls_md_hmac(const void *, const unsigned char *key,
                           size_t keySize, const unsigned char *body,
                           size_t size, unsigned char *out) {
  unsigned int n = 0;
  return HMAC(EVP_sha256(), key, int(keySize), body, size, out, &n) && n == 32
             ? 0
             : 1;
}
