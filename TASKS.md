#Edit Event:
- ~~Falta agregar la fecha en el query~~
- EventTypeQuery - En Vacio

#Create Event:
- Al crear store se re-renderiza el form, haciendo fetch a todo.
- EventTypeQuery - En Vacio
- CreateRequestStore - Fallo del tenantID
- CreateDistributorMutation - Fallo del tenantID
- CreateRetailerMutation - Fallo del tenantID
- Validación: 
    - Se valida el input pero no hay alert
- Cuando fallan los enpoints o al crear un requestStore, distributor o retailer, se renderiza dos veces el componente.


#Edit Request
- Request Type: El id del requestType de los request ya creado no coincide con el de los catalogos.




