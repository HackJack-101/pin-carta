export class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

export async function throwApiError(res: Response, fallback: string): Promise<never> {
    let message = fallback;
    try {
        const body = await res.json();
        if (body?.error) message = body.error;
    } catch {}
    throw new ApiError(message, res.status);
}
