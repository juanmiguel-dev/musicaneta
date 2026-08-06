/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

type R2Bucket = import('@cloudflare/workers-types').R2Bucket;

interface Env {
  MUSIC_BUCKET: R2Bucket;
  R2_PUBLIC_DOMAIN?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
}

declare namespace App {
  interface Locals {
    runtime: {
      env: Env;
    };
  }
}
