import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface StoredFile {
  key: string;
  url: string;
  size: number;
  mimeType: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3?: S3Client;
  private readonly bucket: string;
  private readonly uploadDir: string;
  private readonly publicUrl?: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.get<string>('S3_BUCKET') || 'mining-manager';
    this.uploadDir = config.get<string>('UPLOAD_DIR') || join(process.cwd(), 'uploads');
    this.publicUrl = config.get<string>('S3_PUBLIC_URL');

    if (config.get<string>('S3_ENDPOINT')) {
      this.s3 = new S3Client({
        endpoint: config.get<string>('S3_ENDPOINT'),
        region: config.get<string>('S3_REGION') || 'us-east-1',
        credentials: {
          accessKeyId: config.get<string>('S3_ACCESS_KEY') || '',
          secretAccessKey: config.get<string>('S3_SECRET_KEY') || '',
        },
        forcePathStyle: true,
      });
    }
    if (!existsSync(this.uploadDir)) mkdirSync(this.uploadDir, { recursive: true });
  }

  async upload(file: Express.Multer.File, tenantId: string, prefix = 'reports'): Promise<StoredFile> {
    const extension = file.originalname.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
    const key = `${tenantId}/${prefix}/${randomUUID()}.${extension}`;

    if (this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'public-read',
        }),
      );
      return {
        key,
        url: this.publicUrl ? `${this.publicUrl}/${key}` : `/api/reports/files/${key}`,
        size: file.size,
        mimeType: file.mimetype,
      };
    }

    const filePath = join(this.uploadDir, key);
    mkdirSync(join(this.uploadDir, tenantId, prefix), { recursive: true });
    writeFileSync(filePath, file.buffer);
    this.logger.warn('Usando almacenamiento local. Configura S3 para producción.');
    return {
      key,
      url: `/api/reports/files/${key}`,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  async remove(key: string): Promise<void> {
    if (this.s3) {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
      return;
    }
    const filePath = join(this.uploadDir, key);
    if (existsSync(filePath)) unlinkSync(filePath);
  }

  getLocalPath(key: string): string {
    return join(this.uploadDir, key);
  }
}
