import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | StreamableFile> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T> | StreamableFile> {
    return next.handle().pipe(
      map((data): ApiResponse<T> | StreamableFile => {
        // Ficheiros exportados (Excel/CSV) não levam envelope
        if (data instanceof StreamableFile) return data;
        return { success: true, data, timestamp: new Date().toISOString() };
      }),
    );
  }
}
