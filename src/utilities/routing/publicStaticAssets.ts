/** Next populates the asset inventory when compiling the app. */
export function isPublicStaticAssetPath(pathname: string): boolean {
  const publicStaticAssetPaths: string[] = JSON.parse(process.env.PUBLIC_STATIC_ASSET_PATHS ?? '[]')
  return publicStaticAssetPaths.includes(pathname)
}
