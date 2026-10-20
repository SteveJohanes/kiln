
import {
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

@Injectable()
export class TokenEncryptionService {
  private getKey(): Buffer {
    const encodedKey =
      process.env.TOKEN_ENCRYPTION_KEY;

    if (!encodedKey) {
      throw new InternalServerErrorException(
        "TOKEN_ENCRYPTION_KEY belum dikonfigurasi.",
      );
    }

    const key = Buffer.from(encodedKey, "base64");

    if (
      key.length !== KEY_LENGTH ||
      key.toString("base64") !== encodedKey
    ) {
      throw new InternalServerErrorException(
        "TOKEN_ENCRYPTION_KEY harus berupa Base64 dari 32 byte.",
      );
    }

    return key;
  }

  encrypt(plaintext: string): string {
    const key = this.getKey();
    const iv = randomBytes(IV_LENGTH);

    const cipher = createCipheriv(
      ALGORITHM,
      key,
      iv,
    );

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return [
      "v1",
      iv.toString("base64"),
      authTag.toString("base64"),
      ciphertext.toString("base64"),
    ].join(".");
  }

  decrypt(encryptedValue: string): string {
    const parts = encryptedValue.split(".");

    if (parts.length !== 4 || parts[0] !== "v1") {
      throw new InternalServerErrorException(
        "Format token terenkripsi tidak valid.",
      );
    }

    const [, encodedIv, encodedTag, encodedCiphertext] =
      parts;

    const iv = Buffer.from(encodedIv, "base64");
    const authTag = Buffer.from(encodedTag, "base64");
    const ciphertext = Buffer.from(
      encodedCiphertext,
      "base64",
    );

    if (
      iv.length !== IV_LENGTH ||
      authTag.length !== AUTH_TAG_LENGTH
    ) {
      throw new InternalServerErrorException(
        "Data token terenkripsi tidak valid.",
      );
    }

    const decipher = createDecipheriv(
      ALGORITHM,
      this.getKey(),
      iv,
    );

    decipher.setAuthTag(authTag);

    try {
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      return plaintext.toString("utf8");
    } catch {
      throw new InternalServerErrorException(
        "Token tidak dapat didekripsi. Kunci mungkin berubah atau data rusak.",
      );
    }
  }
}
