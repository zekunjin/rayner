export default eventHandler(async (event) => {
  const body: RaynerAdapter = await readBody(event)
  await store.diso(body)
  return {}
})
