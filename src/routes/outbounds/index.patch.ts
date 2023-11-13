export default eventHandler(async (event) => {
  const body: RaynerOutbound = await readBody(event)
  const { enabled } = body
  await store?.[enabled ? 'eno' : 'diso'](body)
  return {}
})