/** The app-scoped version of the string. */
export function app_scoped(string: string, scope: string): string{
    if(scope.length > 0) return `${scope}-${string}`;
    return string;
}
