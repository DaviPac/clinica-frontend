import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  constructor(private http: HttpClient) {}

  obterApiKey() {
    return this.http.get<{ api_key: string }>(`/gemini/api-key`)
  }
}
