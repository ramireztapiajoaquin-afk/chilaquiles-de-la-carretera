-- Ejecutar una sola vez en Supabase > SQL Editor.
-- Crea un punto de entrada seguro para que el menú público confirme pedidos.

-- Inventario: stock nulo significa existencias ilimitadas.
alter table public.products add column if not exists stock integer;
alter table public.products add column if not exists low_stock_threshold integer default 5;
alter table public.products drop constraint if exists products_stock_nonnegative;
alter table public.products add constraint products_stock_nonnegative check (stock is null or stock >= 0);
alter table public.products drop constraint if exists products_low_stock_nonnegative;
alter table public.products add constraint products_low_stock_nonnegative check (low_stock_threshold >= 0);
alter table public.pedido_items add column if not exists product_id uuid references public.products(id);
alter table public.pedidos add column if not exists cancelado_at timestamptz;
alter table public.pedidos add column if not exists motivo_cancelacion text;
alter table public.pedidos add column if not exists cancelado_por uuid;
alter table public.pedidos add column if not exists inventario_repuesto boolean default false;
alter table public.pedidos drop constraint if exists pedidos_estado_check;
alter table public.pedidos add constraint pedidos_estado_check check (estado in ('nuevo','aceptado','en_preparacion','listo','entregado','cobrado','cancelado'));

-- Guardado específico de inventario para el propietario o administrador.
create or replace function public.actualizar_inventario_producto(
  p_product_id uuid,
  p_stock integer,
  p_low_stock_threshold integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.products p
    join public.categories c on c.id=p.category_id
    join public.restaurants r on r.id=c.restaurant_id
    where p.id=p_product_id
      and (r.owner_id=auth.uid() or exists (
        select 1 from public.meseros m
        where m.user_id=auth.uid() and m.restaurant_id=r.id and m.activo=true and m.rol='admin'
      ))
  ) then
    raise exception 'No tienes permiso para actualizar este inventario';
  end if;

  update public.products
  set stock=case when p_stock is null then null else greatest(0,p_stock) end,
      low_stock_threshold=greatest(0,coalesce(p_low_stock_threshold,5)),
      available=case when p_stock is null then available else p_stock>0 end
  where id=p_product_id;
end;
$$;

revoke all on function public.actualizar_inventario_producto(uuid,integer,integer) from public;
grant execute on function public.actualizar_inventario_producto(uuid,integer,integer) to authenticated;

create or replace function public.confirmar_pedido_cliente(
  p_restaurant_id uuid,
  p_numero_mesa text,
  p_observaciones text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido_id uuid;
  v_total numeric := 0;
  v_item jsonb;
  v_producto text;
  v_cantidad integer;
  v_precio numeric;
  v_product_id uuid;
  v_stock integer;
begin
  if not exists (
    select 1 from public.restaurants
    where id = p_restaurant_id and active = true
  ) then
    raise exception 'Restaurante no disponible';
  end if;

  if nullif(btrim(p_numero_mesa), '') is null then
    raise exception 'El número de mesa es obligatorio';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 50 then
    raise exception 'El pedido no contiene productos válidos';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_cantidad := coalesce((v_item->>'cantidad')::integer, 0);
    begin
      v_product_id := (v_item->>'product_id')::uuid;
    exception when others then
      raise exception 'Producto inválido';
    end;

    select p.name,
           coalesce(
             nullif(regexp_replace(replace(coalesce(p.promo_price, ''), ',', '.'), '[^0-9.]', '', 'g'), ''),
             nullif(regexp_replace(replace(coalesce(p.price, ''), ',', '.'), '[^0-9.]', '', 'g'), '')
           )::numeric,
           p.stock
      into v_producto, v_precio, v_stock
      from public.products p
      join public.categories c on c.id = p.category_id
     where p.id = v_product_id
       and c.restaurant_id = p_restaurant_id
       and p.visible = true
       and p.available = true
     for update of p;

    if v_producto is null or v_cantidad < 1 or v_cantidad > 99 or v_precio is null or v_precio < 0 then
      raise exception 'Producto inválido';
    end if;
    if v_stock is not null and v_stock < v_cantidad then
      raise exception 'Existencias insuficientes para %', v_producto;
    end if;
    v_total := v_total + (v_cantidad * v_precio);
  end loop;

  insert into public.pedidos (
    restaurant_id, numero_mesa, observaciones, total, estado
  ) values (
    p_restaurant_id, left(btrim(p_numero_mesa), 12),
    nullif(left(btrim(coalesce(p_observaciones, '')), 500), ''),
    v_total, 'nuevo'
  ) returning id into v_pedido_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_cantidad := (v_item->>'cantidad')::integer;
    select p.name,
           coalesce(
             nullif(regexp_replace(replace(coalesce(p.promo_price, ''), ',', '.'), '[^0-9.]', '', 'g'), ''),
             nullif(regexp_replace(replace(coalesce(p.price, ''), ',', '.'), '[^0-9.]', '', 'g'), '')
           )::numeric
      into v_producto, v_precio
      from public.products p
      join public.categories c on c.id = p.category_id
     where p.id = v_product_id and c.restaurant_id = p_restaurant_id;

    insert into public.pedido_items (
      pedido_id, product_id, producto, cantidad, precio
    ) values (
      v_pedido_id,
      v_product_id,
      left(v_producto, 160),
      v_cantidad,
      v_precio
    );

    update public.products
       set stock = case when stock is null then null else stock - v_cantidad end,
           available = case when stock is null then available else (stock - v_cantidad) > 0 end
     where id = v_product_id;
  end loop;

  return v_pedido_id;
end;
$$;

revoke all on function public.confirmar_pedido_cliente(uuid,text,text,jsonb) from public;
grant execute on function public.confirmar_pedido_cliente(uuid,text,text,jsonb) to anon, authenticated;

-- Permite que el cliente consulte únicamente el pedido cuyo folio conoce.
create or replace function public.consultar_estado_pedido_cliente(p_pedido_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'id', id,
    'numero_mesa', numero_mesa,
    'estado', estado,
    'motivo_cancelacion', motivo_cancelacion,
    'updated_at', updated_at
  )
  from public.pedidos
  where id = p_pedido_id;
$$;

revoke all on function public.consultar_estado_pedido_cliente(uuid) from public;
grant execute on function public.consultar_estado_pedido_cliente(uuid) to anon, authenticated;

-- Registra una solicitud del cliente y evita avisos duplicados pendientes.
create or replace function public.registrar_solicitud_cliente(
  p_pedido_id uuid,
  p_tipo text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_numero_mesa text;
  v_solicitud_id uuid;
begin
  if p_tipo not in ('llamar_mesero','pedir_cuenta') then
    raise exception 'Tipo de solicitud inválido';
  end if;

  select restaurant_id, numero_mesa
    into v_restaurant_id, v_numero_mesa
    from public.pedidos
   where id = p_pedido_id
     and estado <> 'cobrado';

  if v_restaurant_id is null then
    raise exception 'Pedido no disponible';
  end if;

  select id into v_solicitud_id
    from public.solicitudes_mesa
   where restaurant_id = v_restaurant_id
     and numero_mesa::text = v_numero_mesa::text
     and tipo = p_tipo
     and estado = 'nueva'
   order by created_at desc
   limit 1;

  if v_solicitud_id is null then
    insert into public.solicitudes_mesa (
      restaurant_id, numero_mesa, tipo, estado
    ) values (
      v_restaurant_id, v_numero_mesa, p_tipo, 'nueva'
    ) returning id into v_solicitud_id;
  end if;

  return v_solicitud_id;
end;
$$;

revoke all on function public.registrar_solicitud_cliente(uuid,text) from public;
grant execute on function public.registrar_solicitud_cliente(uuid,text) to anon, authenticated;

-- Cancela pedidos antes de preparación y devuelve inventario una sola vez.
create or replace function public.cancelar_pedido_restaurante(p_pedido_id uuid,p_motivo text)
returns void language plpgsql security definer set search_path=public as $$
declare v_restaurant_id uuid;v_estado text;v_mesero_id uuid;v_actor_id uuid;v_ya_repuesto boolean;v_item record;
begin
 select p.restaurant_id,p.estado,p.mesero_id,coalesce(p.inventario_repuesto,false)
 into v_restaurant_id,v_estado,v_mesero_id,v_ya_repuesto from public.pedidos p where p.id=p_pedido_id for update;
 select m.id into v_actor_id from public.meseros m where m.user_id=auth.uid() and m.restaurant_id=v_restaurant_id and m.activo=true and m.rol in ('mesero','admin') limit 1;
 if v_actor_id is null then raise exception 'No tienes permiso para cancelar este pedido';end if;
 if v_estado not in ('nuevo','aceptado') then raise exception 'El pedido ya no puede cancelarse';end if;
 if v_estado='aceptado' and v_mesero_id is distinct from v_actor_id and not exists(select 1 from public.meseros where id=v_actor_id and rol='admin') then raise exception 'Este pedido pertenece a otro mesero';end if;
 if not v_ya_repuesto then
  for v_item in select product_id,cantidad from public.pedido_items where pedido_id=p_pedido_id and product_id is not null loop
   update public.products set stock=case when stock is null then null else stock+v_item.cantidad end,available=case when stock is null then available else true end where id=v_item.product_id;
  end loop;
 end if;
 update public.pedidos set estado='cancelado',cancelado_at=now(),cancelado_por=v_actor_id,motivo_cancelacion=left(coalesce(nullif(btrim(p_motivo),''),'Sin motivo'),300),inventario_repuesto=true,updated_at=now() where id=p_pedido_id;
end;$$;
revoke all on function public.cancelar_pedido_restaurante(uuid,text) from public;
grant execute on function public.cancelar_pedido_restaurante(uuid,text) to authenticated;

-- Datos para caja y formas de pago.
alter table public.pedidos add column if not exists forma_pago text;
alter table public.pedidos add column if not exists cobrado_at timestamptz;

alter table public.pedidos drop constraint if exists pedidos_forma_pago_check;
alter table public.pedidos add constraint pedidos_forma_pago_check
  check (forma_pago is null or forma_pago in ('efectivo','tarjeta','transferencia'));

-- Accesos separados para Meseros, Cocina y Caja.
alter table public.meseros add column if not exists rol text default 'mesero';
update public.meseros set rol = 'mesero' where rol is null;
alter table public.meseros drop constraint if exists meseros_rol_check;
alter table public.meseros add constraint meseros_rol_check check (rol in ('mesero','cocina','caja','admin'));

insert into public.meseros (user_id, restaurant_id, nombre, activo, rol)
select 'ba92335a-d3bc-4932-bbf5-5ff18f4c1a0c'::uuid, r.id, 'Cocina', true, 'cocina' from public.restaurants r
where r.slug='chilaquiles-de-la-carretera' and not exists (select 1 from public.meseros m where m.user_id='ba92335a-d3bc-4932-bbf5-5ff18f4c1a0c'::uuid);
update public.meseros set restaurant_id=(select id from public.restaurants where slug='chilaquiles-de-la-carretera' limit 1),nombre='Cocina',activo=true,rol='cocina' where user_id='ba92335a-d3bc-4932-bbf5-5ff18f4c1a0c'::uuid;

insert into public.meseros (user_id, restaurant_id, nombre, activo, rol)
select 'ec72e93e-4dc7-490c-89a9-785d9ae11b59'::uuid, r.id, 'Caja', true, 'caja' from public.restaurants r
where r.slug='chilaquiles-de-la-carretera' and not exists (select 1 from public.meseros m where m.user_id='ec72e93e-4dc7-490c-89a9-785d9ae11b59'::uuid);
update public.meseros set restaurant_id=(select id from public.restaurants where slug='chilaquiles-de-la-carretera' limit 1),nombre='Caja',activo=true,rol='caja' where user_id='ec72e93e-4dc7-490c-89a9-785d9ae11b59'::uuid;
