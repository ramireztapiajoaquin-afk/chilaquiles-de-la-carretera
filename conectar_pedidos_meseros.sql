-- Ejecutar una sola vez en Supabase > SQL Editor.
-- Crea un punto de entrada seguro para que el menú público confirme pedidos.

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
           )::numeric
      into v_producto, v_precio
      from public.products p
      join public.categories c on c.id = p.category_id
     where p.id = v_product_id
       and c.restaurant_id = p_restaurant_id
       and p.visible = true
       and p.available = true;

    if v_producto is null or v_cantidad < 1 or v_cantidad > 99 or v_precio is null or v_precio < 0 then
      raise exception 'Producto inválido';
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
      pedido_id, producto, cantidad, precio
    ) values (
      v_pedido_id,
      left(v_producto, 160),
      (v_item->>'cantidad')::integer,
      v_precio
    );
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
    'updated_at', updated_at
  )
  from public.pedidos
  where id = p_pedido_id;
$$;

revoke all on function public.consultar_estado_pedido_cliente(uuid) from public;
grant execute on function public.consultar_estado_pedido_cliente(uuid) to anon, authenticated;
